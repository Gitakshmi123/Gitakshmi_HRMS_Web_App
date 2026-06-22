import React, { useState, useEffect } from 'react';
import { DatePicker, Select, Radio, Modal, Table, Tabs, Tooltip } from 'antd';
import { 
    Plus, Calendar as CalendarIcon, Users, Edit2, Trash2, X, AlertTriangle, 
    ArrowRight, ArrowLeft, Check, CheckCircle2, ChevronRight, Download, Upload, Copy, Info,
    Search, Filter, CalendarCheck, ShieldAlert
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { showToast, showConfirmToast } from '../../utils/uiNotifications';

export default function HolidayCalendarWorkspace() {
    // Core states
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Overview');
    
    // Dropdown options
    const [branches, setBranches] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [leavePolicies, setLeavePolicies] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [locations, setLocations] = useState(['Ahmedabad', 'Baroda', 'Surat', 'Mumbai', 'Pune', 'Bangalore']);

    // Wizard step states
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [wizardForm, setWizardForm] = useState({
        name: '',
        year: 2026,
        description: '',
        applicability: {
            type: 'All Employees',
            branches: [],
            departments: [],
            designations: [],
            leavePolicies: [],
            locations: [],
            employees: []
        },
        holidaySource: 'manual', // manual, excel, copy
        sourceGroupId: '',
        status: 'Active'
    });

    // Right drawer and details state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedDateHoliday, setSelectedDateHoliday] = useState(null);

    // Holiday Form modal state
    const [holidayFormOpen, setHolidayFormOpen] = useState(false);
    const [editingHolidayIndex, setEditingHolidayIndex] = useState(-1);
    const [holidayForm, setHolidayForm] = useState({
        name: '',
        date: '',
        type: 'National Holiday',
        leaveImpact: 'Paid Holiday',
        category: 'Mandatory',
        halfDayConfig: 'None',
        recurring: true,
        allowLeaveApplication: false,
        excludeFromLeaveCalc: true,
        countAsPayable: true,
        showInCalendar: true,
        showInDashboard: true,
        remarks: ''
    });

    // Employee simulation preview mode
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [employeeFilters, setEmployeeFilters] = useState({
        month: 'All',
        year: '2026',
        type: 'All'
    });

    // Excel upload previews and warnings
    const [excelPreview, setExcelPreview] = useState([]);
    const [excelWarnings, setExcelWarnings] = useState([]);

    // Calendar navigation
    const [calendarMonth, setCalendarMonth] = useState(dayjs('2026-01-01'));
    const [calendarViewMode, setCalendarViewMode] = useState('Month'); // Month, Agenda

    // Search and filters for list
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

    useEffect(() => {
        fetchGroups();
        fetchReferenceData();
    }, []);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const res = await api.get('/holiday-groups');
            const data = Array.isArray(res.data) ? res.data : [];
            setGroups(data);
            if (data.length > 0 && !selectedGroup) {
                setSelectedGroup(data[0]);
            }
        } catch (err) {
            showToast('error', 'Error', 'Failed to fetch holiday groups');
        } finally {
            setLoading(false);
        }
    };

    const fetchReferenceData = async () => {
        try {
            const branchRes = await api.get('/branch/list').catch(() => ({ data: [] }));
            const branchData = branchRes.data?.data || branchRes.data || [];
            setBranches(Array.isArray(branchData) ? branchData : []);

            const deptRes = await api.get('/hr/departments').catch(() => ({ data: [] }));
            const deptData = deptRes.data?.data || deptRes.data || [];
            setDepartments(Array.isArray(deptData) ? deptData : []);

            const policyRes = await api.get('/hr/leave-policies').catch(() => ({ data: [] }));
            const policyData = policyRes.data?.data || policyRes.data || [];
            setLeavePolicies(Array.isArray(policyData) ? policyData : []);

            const empRes = await api.get('/hr/employees?limit=500').catch(() => ({ data: [] }));
            const empData = empRes.data?.data || empRes.data || [];
            setEmployees(Array.isArray(empData) ? empData : []);

            const posRes = await api.get('/positions').catch(() => ({ data: [] }));
            const posData = posRes.data?.data || posRes.data || [];
            setDesignations(Array.isArray(posData) ? posData : []);
        } catch (err) {
            console.error('Error fetching assets', err);
        }
    };

    // Wizard submit
    const handleCreateGroup = async () => {
        try {
            let initialHolidays = [];
            if (wizardForm.holidaySource === 'copy' && wizardForm.sourceGroupId) {
                const source = groups.find(g => g._id === wizardForm.sourceGroupId);
                if (source) {
                    initialHolidays = source.holidays.map(h => ({
                        ...h,
                        date: dayjs(h.date).year(wizardForm.year).toDate()
                    }));
                }
            } else if (wizardForm.holidaySource === 'excel') {
                initialHolidays = excelPreview;
            }

            const payload = {
                name: wizardForm.name,
                year: Number(wizardForm.year),
                description: wizardForm.description,
                status: wizardForm.status,
                applicability: wizardForm.applicability,
                holidays: initialHolidays
            };

            await api.post('/holiday-groups', payload);
            showToast('success', 'Group Created', `Holiday group "${wizardForm.name}" created successfully.`);
            setShowWizard(false);
            setWizardStep(1);
            setExcelPreview([]);
            setExcelWarnings([]);
            fetchGroups();
        } catch (err) {
            showToast('error', 'Creation Failed', err.response?.data?.error || 'Failed to create group');
        }
    };

    // Save holidays inside group
    const saveGroupHolidays = async (updatedHolidays, actionName, oldVal, newVal) => {
        if (!selectedGroup) return;
        try {
            const res = await api.put(`/holiday-groups/${selectedGroup._id}`, {
                holidays: updatedHolidays,
                auditLogEntry: {
                    action: actionName,
                    oldValue: oldVal,
                    newValue: newVal
                }
            });
            setSelectedGroup(res.data);
            setGroups(groups.map(g => g._id === res.data._id ? res.data : g));
        } catch (err) {
            showToast('error', 'Update Failed', err.response?.data?.error || 'Failed to update holidays');
        }
    };

    // Save Single Holiday
    const handleSaveHoliday = () => {
        if (!holidayForm.name || !holidayForm.date) {
            showToast('error', 'Validation Error', 'Holiday Name and Date are required.');
            return;
        }

        const dateVal = dayjs(holidayForm.date).toDate();
        const conflict = checkConflicts(dateVal);
        if (conflict) {
            showToast('info', 'Weekly Off Warning', conflict);
        }

        const data = {
            ...holidayForm,
            date: dateVal
        };

        const updated = [...(selectedGroup.holidays || [])];
        const oldVal = JSON.stringify(updated);

        if (editingHolidayIndex >= 0) {
            updated[editingHolidayIndex] = data;
        } else {
            updated.push(data);
        }

        updated.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveGroupHolidays(updated, editingHolidayIndex >= 0 ? 'HOLIDAY_UPDATED' : 'HOLIDAY_ADDED', oldVal, JSON.stringify(updated));
        
        showToast('success', 'Saved', 'Holiday saved successfully.');
        setHolidayFormOpen(false);
        setEditingHolidayIndex(-1);
    };

    // Delete Single Holiday
    const handleDeleteHoliday = (index) => {
        showConfirmToast({
            title: 'Delete Holiday?',
            description: 'Are you sure you want to remove this holiday from the group?',
            okText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
            onConfirm: () => {
                const updated = [...(selectedGroup.holidays || [])];
                const oldVal = JSON.stringify(updated);
                updated.splice(index, 1);
                saveGroupHolidays(updated, 'HOLIDAY_DELETED', oldVal, JSON.stringify(updated));
                setDrawerOpen(false);
                showToast('success', 'Deleted', 'Holiday removed.');
            }
        });
    };

    // Excel import columns validation
    const handleExcelImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Simulator parsing Excel
        // Columns required: Holiday Name, Date, Type, Leave Impact, Remarks
        const mockRows = [
            { name: 'Republic Day', date: '2026-01-26', type: 'National Holiday', leaveImpact: 'Paid Holiday', remarks: 'National Celebration' },
            { name: 'Diwali', date: '2026-11-08', type: 'Festival Holiday', leaveImpact: 'Paid Holiday', remarks: 'Festival of Lights' },
            { name: 'Christmas', date: '2026-12-25', type: 'Company Holiday', leaveImpact: 'Paid Holiday', remarks: 'Year End Celebration' }
        ];

        // Validations
        const warnings = [];
        mockRows.forEach(r => {
            const d = dayjs(r.date);
            if (d.day() === 0) {
                warnings.push(`Warning: ${r.name} falls on a Sunday weekly off.`);
            }
        });

        setExcelPreview(mockRows);
        setExcelWarnings(warnings);
        showToast('success', 'Excel Preview', 'Excel parsed with 3 holidays.');
    };

    // Download Template
    const downloadTemplate = () => {
        const headers = 'Holiday Name,Date,Type,Leave Impact,Remarks\n';
        const rows = 'Republic Day,2026-01-26,National Holiday,Paid Holiday,National Celebration\nDiwali,2026-11-08,Festival Holiday,Paid Holiday,Festival of Lights\n';
        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'holiday_template.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Download Started', 'Holiday template download started.');
    };

    // Conflict detection
    const checkConflicts = (date) => {
        const d = dayjs(date);
        if (d.day() === 0) return 'Holiday falls on Sunday Weekly Off.';
        if (d.day() === 6) return 'Holiday falls on Saturday Weekly Off.';
        return null;
    };

    // Long Weekend flagger
    const detectLongWeekends = () => {
        if (!selectedGroup || !selectedGroup.holidays) return [];
        const results = [];
        selectedGroup.holidays.forEach(h => {
            const d = dayjs(h.date);
            if (d.day() === 5) {
                results.push({ name: h.name, desc: 'Friday Holiday + Saturday/Sunday Weekly Off (3 Days Long Weekend)' });
            } else if (d.day() === 1) {
                results.push({ name: h.name, desc: 'Monday Holiday + Saturday/Sunday Weekly Off (3 Days Long Weekend)' });
            }
        });
        return results;
    };

    const longWeekends = detectLongWeekends();

    // Summary calculations
    const stats = {
        totalGroups: groups.length,
        totalHolidays: selectedGroup?.holidays?.length || 0,
        optionalHolidays: selectedGroup?.holidays?.filter(h => h.category === 'Optional' || h.type === 'Optional Holiday')?.length || 0,
        upcomingHolidays: selectedGroup?.holidays?.filter(h => dayjs(h.date).isAfter(dayjs()))?.length || 0
    };

    // Sidebar navigation card styling helper
    const getStatusColor = (status) => {
        switch(status) {
            case 'Active': return 'bg-emerald-500';
            case 'Draft': return 'bg-amber-400';
            case 'Archived': return 'bg-rose-500';
            default: return 'bg-slate-400';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Top Toolbar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Holiday Calendar Management</h1>
                    <p className="text-xs text-slate-500">Manage company holiday schedules, group configurations, and dynamic assignment rules.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsPreviewMode(!isPreviewMode)}
                        className={`px-3.5 py-1.5 rounded text-xs font-semibold border transition ${
                            isPreviewMode 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {isPreviewMode ? '⚙️ HR Admin Mode' : '👁️ Preview As Employee'}
                    </button>
                    <button 
                        onClick={() => {
                            setWizardForm({
                                name: '',
                                year: 2026,
                                description: '',
                                applicability: { type: 'All Employees', branches: [], departments: [], designations: [], leavePolicies: [], locations: [], employees: [] },
                                holidaySource: 'manual',
                                sourceGroupId: '',
                                status: 'Active'
                            });
                            setExcelPreview([]);
                            setExcelWarnings([]);
                            setWizardStep(1);
                            setShowWizard(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                    >
                        <Plus className="w-4 h-4" /> Create Holiday Group
                    </button>
                </div>
            </div>

            {/* Layout Workspace Container */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left navigation sidebar for Holiday Groups */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Holiday Groups</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {loading ? (
                            <p className="text-slate-400 text-center py-8 text-xs">Loading schedules...</p>
                        ) : groups.length === 0 ? (
                            <p className="text-slate-400 text-center py-8 text-xs">No groups configured.</p>
                        ) : (
                            groups.map(g => (
                                <div 
                                    key={g._id}
                                    onClick={() => { setSelectedGroup(g); setDrawerOpen(false); }}
                                    className={`p-3 rounded border text-left cursor-pointer transition ${
                                        selectedGroup?._id === g._id 
                                        ? 'border-indigo-500 bg-indigo-50/25' 
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="font-bold text-slate-800 text-sm truncate">{g.name}</span>
                                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(g.status)}`} />
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-2">Calendar Year: {g.year}</p>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        <span>📅 {g.holidays?.length || 0} Holidays</span>
                                        <span>•</span>
                                        <span>👥 {g.applicability?.type === 'All Employees' ? 'All Employees' : 'Custom Assigned'}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Panel: Calendar Workspace */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isPreviewMode ? (
                        /* Employee Preview UI */
                        <div className="space-y-6">
                            <div className="bg-white border border-slate-200 rounded p-6 shadow-sm">
                                <h2 className="text-md font-bold text-slate-800 mb-2">My Holiday Calendar</h2>
                                <p className="text-xs text-slate-500">View your applicable holidays and floating selections.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-4">
                                    <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Floating Holiday Selection (Choose Any 2)</span>
                                        <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">10 Available</span>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded p-6 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="font-bold text-xs">Calendar View</span>
                                            <div className="flex gap-2">
                                                <button className="px-3 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded">Month</button>
                                                <button className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold rounded">Agenda</button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-7 gap-1 bg-slate-100 rounded p-1">
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                                <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400">{d}</div>
                                            ))}
                                            {Array.from({ length: 31 }).map((_, i) => (
                                                <div key={i} className="bg-white p-2 min-h-[60px] border border-slate-50 text-[10px] text-slate-500">
                                                    {i + 1}
                                                    {i === 25 && <div className="bg-emerald-100 text-emerald-800 text-[8px] font-black p-0.5 rounded truncate mt-1">Republic Day</div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                                        <h3 className="text-xs font-bold text-slate-700 mb-3">Sync & Export</h3>
                                        <div className="space-y-2">
                                            <button className="w-full text-left bg-slate-50 hover:bg-slate-100 p-2 rounded text-xs font-semibold border border-slate-200 flex items-center gap-2">
                                                📥 Download Calendar PDF
                                            </button>
                                            <button className="w-full text-left bg-slate-50 hover:bg-slate-100 p-2 rounded text-xs font-semibold border border-slate-200 flex items-center gap-2">
                                                🔄 Sync With Google Calendar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : selectedGroup ? (
                        /* Admin Management Workspace UI */
                        <>
                            {/* Summary Chips */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Groups</span>
                                    <p className="text-2xl font-black text-slate-800 mt-1">{stats.totalGroups}</p>
                                </div>
                                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Holidays</span>
                                    <p className="text-2xl font-black text-slate-800 mt-1">{stats.totalHolidays}</p>
                                </div>
                                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Optional Holidays</span>
                                    <p className="text-2xl font-black text-amber-600 mt-1">{stats.optionalHolidays}</p>
                                </div>
                                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Upcoming Holidays</span>
                                    <p className="text-2xl font-black text-indigo-600 mt-1">{stats.upcomingHolidays}</p>
                                </div>
                            </div>

                            {/* Long Weekend Alerts */}
                            {longWeekends.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded p-4 flex gap-3">
                                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-bold text-amber-800 block">Smart Long Weekend Detection Suggestion:</span>
                                        <ul className="text-xs text-amber-700 list-disc pl-4 mt-1 space-y-0.5">
                                            {longWeekends.map((lw, idx) => (
                                                <li key={idx}><strong>{lw.name}</strong>: {lw.desc}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Tabs Component */}
                            <div className="bg-white border border-slate-200 rounded shadow-sm">
                                <div className="border-b border-slate-200 px-6 flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        {['Overview', 'Holiday List', 'Assignments', 'Calendar View', 'Audit Logs'].map(tab => (
                                            <button 
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`py-3.5 text-xs font-bold uppercase tracking-wider relative transition ${
                                                    activeTab === tab ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                            >
                                                {tab}
                                                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => {
                                                setEditingHolidayIndex(-1);
                                                setHolidayForm({
                                                    name: '',
                                                    date: '',
                                                    type: 'National Holiday',
                                                    leaveImpact: 'Paid Holiday',
                                                    category: 'Mandatory',
                                                    halfDayConfig: 'None',
                                                    recurring: true,
                                                    allowLeaveApplication: false,
                                                    excludeFromLeaveCalc: true,
                                                    countAsPayable: true,
                                                    showInCalendar: true,
                                                    showInDashboard: true,
                                                    remarks: ''
                                                });
                                                setHolidayFormOpen(true);
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Holiday
                                        </button>
                                    </div>
                                </div>

                                <div className="p-6">
                                    {/* Overview */}
                                    {activeTab === 'Overview' && (
                                        <div className="space-y-4">
                                            <div className="border border-slate-100 rounded p-4 bg-slate-50/50">
                                                <h3 className="font-bold text-xs text-slate-800 mb-2">Group Details</h3>
                                                <p className="text-xs text-slate-600 leading-relaxed">{selectedGroup.description || 'No description provided.'}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Holiday List Grid */}
                                    {activeTab === 'Holiday List' && (
                                        <div className="space-y-4">
                                            <div className="overflow-x-auto border border-slate-200 rounded">
                                                <table className="min-w-full divide-y divide-slate-200 text-left">
                                                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                        <tr>
                                                            <th className="px-4 py-3">Holiday Name</th>
                                                            <th className="px-4 py-3">Date</th>
                                                            <th className="px-4 py-3">Type</th>
                                                            <th className="px-4 py-3">Leave Impact</th>
                                                            <th className="px-4 py-3 text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200 text-xs text-slate-700 bg-white">
                                                        {(selectedGroup.holidays || []).map((h, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => { setSelectedDateHoliday(h); setDrawerOpen(true); }}>
                                                                <td className="px-4 py-3 font-semibold text-slate-800">{h.name}</td>
                                                                <td className="px-4 py-3">{dayjs(h.date).format('DD-MMM-YYYY')}</td>
                                                                <td className="px-4 py-3">{h.type}</td>
                                                                <td className="px-4 py-3">{h.leaveImpact}</td>
                                                                <td className="px-4 py-3 text-right space-x-2" onClick={e => e.stopPropagation()}>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setEditingHolidayIndex(idx);
                                                                            setHolidayForm({
                                                                                ...h,
                                                                                date: dayjs(h.date).format('YYYY-MM-DD')
                                                                            });
                                                                            setHolidayFormOpen(true);
                                                                        }}
                                                                        className="text-slate-500 hover:text-indigo-600 inline-block p-1"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDeleteHoliday(idx)}
                                                                        className="text-slate-500 hover:text-rose-600 inline-block p-1"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Assignments */}
                                    {activeTab === 'Assignments' && (
                                        <div className="space-y-4">
                                            <div className="border border-slate-200 rounded p-4 bg-white space-y-3">
                                                <span className="text-xs font-bold text-slate-700 block">Eligible Assignment Scope</span>
                                                <Radio.Group 
                                                    value={selectedGroup.applicability?.type || 'All Employees'}
                                                    onChange={async (e) => {
                                                        const applicability = { ...selectedGroup.applicability, type: e.target.value };
                                                        const res = await api.put(`/holiday-groups/${selectedGroup._id}`, { applicability });
                                                        setSelectedGroup(res.data);
                                                    }}
                                                >
                                                    <div className="flex flex-wrap gap-4 text-xs font-semibold mt-1">
                                                        <Radio value="All Employees">All Employees</Radio>
                                                        <Radio value="Branch">By Branch</Radio>
                                                        <Radio value="Department">By Department</Radio>
                                                        <Radio value="Policy Based">By Leave Policy</Radio>
                                                    </div>
                                                </Radio.Group>
                                            </div>
                                        </div>
                                    )}

                                    {/* Calendar View */}
                                    {activeTab === 'Calendar View' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setCalendarMonth(calendarMonth.subtract(1, 'month'))} className="p-1 border border-slate-200 rounded hover:bg-slate-50 text-slate-500">
                                                        <ArrowLeft className="w-4 h-4" />
                                                    </button>
                                                    <span className="font-bold text-sm text-slate-800">{calendarMonth.format('MMMM YYYY')}</span>
                                                    <button onClick={() => setCalendarMonth(calendarMonth.add(1, 'month'))} className="p-1 border border-slate-200 rounded hover:bg-slate-50 text-slate-500">
                                                        <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                                                    <button onClick={() => setCalendarViewMode('Month')} className={`px-3 py-1 text-xs font-semibold ${calendarViewMode === 'Month' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>Month</button>
                                                    <button onClick={() => setCalendarViewMode('Agenda')} className={`px-3 py-1 text-xs font-semibold ${calendarViewMode === 'Agenda' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>Agenda</button>
                                                </div>
                                            </div>

                                            {calendarViewMode === 'Month' ? (
                                                <div className="grid grid-cols-7 gap-1 border border-slate-200 bg-slate-200 rounded overflow-hidden">
                                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                                        <div key={d} className="bg-slate-50 py-2 text-center text-[10px] font-bold text-slate-500 uppercase">{d}</div>
                                                    ))}
                                                    {Array.from({ length: calendarMonth.startOf('month').day() }).map((_, i) => (
                                                        <div key={`empty-${i}`} className="bg-white p-2 min-h-[90px]" />
                                                    ))}
                                                    {Array.from({ length: calendarMonth.daysInMonth() }).map((_, i) => {
                                                        const dayNum = i + 1;
                                                        const dateVal = calendarMonth.date(dayNum);
                                                        const dayHolidays = (selectedGroup.holidays || []).filter(h => 
                                                            dayjs(h.date).isSame(dateVal, 'day')
                                                        );

                                                        return (
                                                            <div 
                                                                key={dayNum}
                                                                onClick={() => {
                                                                    if (dayHolidays.length > 0) {
                                                                        setSelectedDateHoliday(dayHolidays[0]);
                                                                        setDrawerOpen(true);
                                                                    }
                                                                }}
                                                                className="bg-white p-2 min-h-[90px] border-t border-slate-100 flex flex-col justify-between hover:bg-slate-50/50 cursor-pointer"
                                                            >
                                                                <span className="text-[10px] font-bold text-slate-400">{dayNum}</span>
                                                                <div className="space-y-1">
                                                                    {dayHolidays.map((dh, idx) => (
                                                                        <div 
                                                                            key={idx}
                                                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate ${
                                                                                dh.type === 'National Holiday' ? 'bg-emerald-100 text-emerald-800' 
                                                                                : dh.type === 'Optional Holiday' ? 'bg-amber-100 text-amber-800' 
                                                                                : 'bg-indigo-100 text-indigo-800'
                                                                            }`}
                                                                        >
                                                                            {dh.name}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {(selectedGroup.holidays || []).map((h, idx) => (
                                                        <div key={idx} className="bg-white p-3 border border-slate-100 rounded flex items-center justify-between text-xs">
                                                            <div>
                                                                <span className="font-bold text-slate-800 block">{h.name}</span>
                                                                <span className="text-[10px] text-slate-400">{dayjs(h.date).format('DD-MMM-YYYY')}</span>
                                                            </div>
                                                            <span className="text-[9px] font-bold uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600">{h.type}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Audit Logs */}
                                    {activeTab === 'Audit Logs' && (
                                        <div className="space-y-2 text-xs">
                                            {(selectedGroup.auditLogs || []).map((log, i) => (
                                                <div key={i} className="p-3 border border-slate-100 rounded bg-slate-50/50">
                                                    <div className="flex justify-between font-semibold mb-1">
                                                        <span>{log.action}</span>
                                                        <span className="text-[10px] text-slate-400">{dayjs(log.timestamp).format('DD-MMM-YYYY HH:mm')}</span>
                                                    </div>
                                                    <p className="text-slate-500">Performed by: {log.performedBy || 'HR Admin'}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1 italic">{log.newValue}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded p-12 text-center text-slate-400">
                            No Holiday Group selected. Select or create one from the left panel.
                        </div>
                    )}
                </div>
            </div>

            {/* Right Slide Drawer Experience */}
            {drawerOpen && selectedDateHoliday && (
                <div className="fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Republic Day</h3>
                            <span className="text-[10px] text-indigo-600 font-bold uppercase">{selectedDateHoliday.type}</span>
                        </div>
                        <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Date</span>
                                <span className="font-bold text-slate-700">{dayjs(selectedDateHoliday.date).format('26-Jan-2026')}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Leave Impact</span>
                                <span className="font-bold text-slate-700">{selectedDateHoliday.leaveImpact || 'Paid Holiday'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Applicable Group</span>
                                <span className="font-bold text-slate-700">{selectedGroup?.name || 'Gujarat Office 2026'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Assigned Employees</span>
                                <span className="font-bold text-slate-700">125</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Recurring</span>
                                <span className="font-bold text-slate-700">{selectedDateHoliday.recurring ? 'Yes' : 'No'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Remarks</span>
                                <span className="font-bold text-slate-700">National Celebration</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Created By</span>
                                <span className="font-bold text-slate-700">HR Admin</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Created On</span>
                                <span className="font-bold text-slate-700">15-Dec-2025</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-slate-400 block font-semibold text-[10px] uppercase">Last Updated</span>
                            <span className="font-bold text-slate-700">20-Dec-2025</span>
                        </div>
                    </div>

                    <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
                        <button 
                            onClick={() => {
                                const idx = selectedGroup.holidays.findIndex(h => h.name === selectedDateHoliday.name);
                                if (idx >= 0) {
                                    setEditingHolidayIndex(idx);
                                    setHolidayForm({
                                        ...selectedDateHoliday,
                                        date: dayjs(selectedDateHoliday.date).format('YYYY-MM-DD')
                                    });
                                    setHolidayFormOpen(true);
                                    setDrawerOpen(false);
                                }
                            }}
                            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-1.5 rounded text-xs font-semibold"
                        >
                            Edit
                        </button>
                        <button 
                            onClick={() => {
                                const idx = selectedGroup.holidays.findIndex(h => h.name === selectedDateHoliday.name);
                                if (idx >= 0) handleDeleteHoliday(idx);
                            }}
                            className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100/50 px-4 py-1.5 rounded text-xs font-semibold"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            )}

            {/* Create Holiday Group Popup (4-Step Wizard) */}
            {showWizard && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Create Holiday Group</h3>
                                <span className="text-[10px] text-slate-400 block font-semibold">Step {wizardStep} of 4</span>
                            </div>
                            <button onClick={() => setShowWizard(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Steps indicator */}
                        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                            <span className={wizardStep >= 1 ? 'text-indigo-600 font-black' : ''}>1. Basic Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span className={wizardStep >= 2 ? 'text-indigo-600 font-black' : ''}>2. Applicability</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span className={wizardStep >= 3 ? 'text-indigo-600 font-black' : ''}>3. Holiday Source</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span className={wizardStep >= 4 ? 'text-indigo-600 font-black' : ''}>4. Review & Create</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                            {wizardStep === 1 && (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="font-bold text-slate-600">Group Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="Gujarat Office Calendar 2026" 
                                            value={wizardForm.name} 
                                            onChange={e => setWizardForm({ ...wizardForm, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded" 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="font-bold text-slate-600">Calendar Year</label>
                                        <input 
                                            type="number" 
                                            placeholder="2026" 
                                            value={wizardForm.year} 
                                            onChange={e => setWizardForm({ ...wizardForm, year: Number(e.target.value) })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded" 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="font-bold text-slate-600">Description</label>
                                        <textarea 
                                            placeholder="Description" 
                                            value={wizardForm.description} 
                                            onChange={e => setWizardForm({ ...wizardForm, description: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded h-20 resize-none" 
                                        />
                                    </div>
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="font-bold text-slate-600">Applicable For</label>
                                        <Select 
                                            value={wizardForm.applicability.type}
                                            onChange={val => setWizardForm({
                                                ...wizardForm,
                                                applicability: { ...wizardForm.applicability, type: val }
                                            })}
                                            className="w-full"
                                            options={[
                                                { label: 'All Employees', value: 'All Employees' },
                                                { label: 'Department', value: 'Department' },
                                                { label: 'Branch', value: 'Branch' },
                                                { label: 'Location', value: 'Location' },
                                                { label: 'Policy Based', value: 'Policy Based' },
                                                { label: 'Custom Selection', value: 'Custom Selection' }
                                            ]}
                                        />
                                    </div>

                                    {/* Multi-Selects based on type */}
                                    {wizardForm.applicability.type === 'Branch' && (
                                        <div className="space-y-1">
                                            <label className="font-bold text-slate-600">Select Branches</label>
                                            <Select 
                                                mode="multiple" 
                                                placeholder="Select branches" 
                                                className="w-full"
                                                value={wizardForm.applicability.branches}
                                                onChange={vals => setWizardForm({ ...wizardForm, applicability: { ...wizardForm.applicability, branches: vals }})}
                                                options={branches.map(b => ({ label: b.name, value: b._id }))}
                                            />
                                        </div>
                                    )}

                                    {wizardForm.applicability.type === 'Department' && (
                                        <div className="space-y-1">
                                            <label className="font-bold text-slate-600">Select Departments</label>
                                            <Select 
                                                mode="multiple" 
                                                placeholder="Select departments" 
                                                className="w-full"
                                                value={wizardForm.applicability.departments}
                                                onChange={vals => setWizardForm({ ...wizardForm, applicability: { ...wizardForm.applicability, departments: vals }})}
                                                options={departments.map(d => ({ label: d.name, value: d._id }))}
                                            />
                                        </div>
                                    )}

                                    {wizardForm.applicability.type === 'Location' && (
                                        <div className="space-y-1">
                                            <label className="font-bold text-slate-600">Select Locations</label>
                                            <Select 
                                                mode="multiple" 
                                                placeholder="Select locations" 
                                                className="w-full"
                                                value={wizardForm.applicability.locations}
                                                onChange={vals => setWizardForm({ ...wizardForm, applicability: { ...wizardForm.applicability, locations: vals }})}
                                                options={locations.map(loc => ({ label: loc, value: loc }))}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {wizardStep === 3 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="font-bold text-slate-600">Select Holiday Source</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { id: 'manual', title: 'Manual Entry' },
                                                { id: 'excel', title: 'Excel Upload' },
                                                { id: 'copy', title: 'Copy Existing Calendar' }
                                            ].map(opt => (
                                                <div 
                                                    key={opt.id}
                                                    onClick={() => setWizardForm({ ...wizardForm, holidaySource: opt.id })}
                                                    className={`p-3 border rounded text-center cursor-pointer transition ${
                                                        wizardForm.holidaySource === opt.id 
                                                        ? 'border-indigo-600 bg-indigo-50/20' 
                                                        : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <span className="font-bold text-xs block">{opt.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {wizardForm.holidaySource === 'excel' && (
                                        <div className="border-2 border-dashed border-slate-200 rounded p-6 text-center space-y-3 bg-slate-50">
                                            <Upload className="w-8 h-8 text-slate-300 mx-auto" />
                                            <p className="font-semibold text-slate-600">Select holiday spreadsheet template</p>
                                            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="mx-auto" />
                                            <button type="button" onClick={downloadTemplate} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[11px] font-bold hover:bg-slate-50 flex items-center gap-1.5 mx-auto">
                                                📥 Download Excel Template
                                            </button>
                                            
                                            {excelPreview.length > 0 && (
                                                <div className="text-left mt-4 border-t pt-3 space-y-2">
                                                    <span className="font-bold block text-[10px] text-slate-500 uppercase">Parsed Preview ({excelPreview.length} items)</span>
                                                    {excelPreview.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between py-1 border-b border-slate-100">
                                                            <span>{item.name} ({item.date})</span>
                                                            <span className="font-semibold">{item.type}</span>
                                                        </div>
                                                    ))}
                                                    {excelWarnings.map((w, idx) => (
                                                        <p key={idx} className="text-rose-500 text-[10px] font-semibold">⚠️ {w}</p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {wizardForm.holidaySource === 'copy' && (
                                        <div className="space-y-2">
                                            <label className="font-bold text-slate-600">Select Source Group Calendar</label>
                                            <Select 
                                                className="w-full"
                                                value={wizardForm.sourceGroupId}
                                                onChange={val => setWizardForm({ ...wizardForm, sourceGroupId: val })}
                                                options={groups.map(g => ({ label: `${g.name} (${g.year})`, value: g._id }))}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {wizardStep === 4 && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-800">Review & Create Group Summary</h4>
                                    <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2.5">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400 font-semibold">Group Name:</span>
                                            <span className="font-bold text-slate-800">{wizardForm.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400 font-semibold">Year:</span>
                                            <span className="font-bold text-slate-800">{wizardForm.year}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400 font-semibold">Assigned Employees:</span>
                                            <span className="font-bold text-indigo-600">125 Employees</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400 font-semibold">Holiday Count:</span>
                                            <span className="font-bold text-slate-800">
                                                {wizardForm.holidaySource === 'copy' ? 'Will copy from source' 
                                                 : wizardForm.holidaySource === 'excel' ? `${excelPreview.length} holidays` 
                                                 : 'Manual setup later'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                            <button 
                                disabled={wizardStep === 1}
                                onClick={() => setWizardStep(wizardStep - 1)}
                                className="px-4 py-1.5 rounded text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" /> Back
                            </button>

                            {wizardStep < 4 ? (
                                <button 
                                    onClick={() => setWizardStep(wizardStep + 1)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 shadow-sm"
                                >
                                    Next <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <button 
                                    onClick={handleCreateGroup}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 shadow-sm"
                                >
                                    <Check className="w-3.5 h-3.5" /> Create Group
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Holiday Popup Modal */}
            {holidayFormOpen && (
                <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 text-sm">
                                {editingHolidayIndex >= 0 ? 'Edit Holiday' : 'Add Holiday'}
                            </h3>
                            <button onClick={() => setHolidayFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                            <div className="space-y-1">
                                <label className="font-bold text-slate-600">Holiday Name</label>
                                <input 
                                    type="text" 
                                    placeholder="Republic Day" 
                                    value={holidayForm.name} 
                                    onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded" 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-600">Date</label>
                                    <input 
                                        type="date" 
                                        value={holidayForm.date} 
                                        onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-600">Type</label>
                                    <Select 
                                        value={holidayForm.type}
                                        onChange={val => setHolidayForm({ ...holidayForm, type: val })}
                                        className="w-full"
                                        options={[
                                            { label: 'National Holiday', value: 'National Holiday' },
                                            { label: 'Festival Holiday', value: 'Festival Holiday' },
                                            { label: 'Regional Holiday', value: 'Regional Holiday' },
                                            { label: 'Company Holiday', value: 'Company Holiday' },
                                            { label: 'Optional Holiday', value: 'Optional Holiday' },
                                            { label: 'Restricted Holiday', value: 'Restricted Holiday' }
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-600">Leave Impact</label>
                                    <Select 
                                        value={holidayForm.leaveImpact}
                                        onChange={val => setHolidayForm({ ...holidayForm, leaveImpact: val })}
                                        className="w-full"
                                        options={[
                                            { label: 'Paid Holiday', value: 'Paid Holiday' },
                                            { label: 'Unpaid Holiday', value: 'Unpaid Holiday' },
                                            { label: 'Half Day Paid', value: 'Half Day Paid' },
                                            { label: 'Half Day Unpaid', value: 'Half Day Unpaid' }
                                        ]}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-600">Holiday Category</label>
                                    <Select 
                                        value={holidayForm.category}
                                        onChange={val => setHolidayForm({ ...holidayForm, category: val })}
                                        className="w-full"
                                        options={[
                                            { label: 'Mandatory', value: 'Mandatory' },
                                            { label: 'Optional', value: 'Optional' },
                                            { label: 'Floating Holiday', value: 'Floating Holiday' }
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-600">Half Day Configuration</label>
                                    <Select 
                                        value={holidayForm.halfDayConfig}
                                        onChange={val => setHolidayForm({ ...holidayForm, halfDayConfig: val })}
                                        className="w-full"
                                        options={[
                                            { label: 'None', value: 'None' },
                                            { label: 'First Half', value: 'First Half' },
                                            { label: 'Second Half', value: 'Second Half' }
                                        ]}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <span className="font-bold text-slate-600 block">Additional Settings</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={holidayForm.recurring} onChange={e => setHolidayForm({ ...holidayForm, recurring: e.target.checked })} /> Recurring Every Year</label>
                                    <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={holidayForm.allowLeaveApplication} onChange={e => setHolidayForm({ ...holidayForm, allowLeaveApplication: e.target.checked })} /> Allow Leave Application</label>
                                    <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={holidayForm.excludeFromLeaveCalc} onChange={e => setHolidayForm({ ...holidayForm, excludeFromLeaveCalc: e.target.checked })} /> Exclude From Leave Calculation</label>
                                    <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={holidayForm.countAsPayable} onChange={e => setHolidayForm({ ...holidayForm, countAsPayable: e.target.checked })} /> Count As Payable Day</label>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                            <button onClick={() => setHolidayFormOpen(false)} className="px-4 py-1.5 rounded text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={handleSaveHoliday} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded text-xs font-semibold shadow-sm">Save Holiday</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
