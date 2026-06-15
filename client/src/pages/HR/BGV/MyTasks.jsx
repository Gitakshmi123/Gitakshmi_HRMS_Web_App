import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, AlertCircle, CheckCircle, XCircle, User, Calendar, FileText, ChevronRight, Target, ClipboardList } from 'lucide-react';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const MyTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedTask, setSelectedTask] = useState(null);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);

    useEffect(() => {
        fetchMyTasks();
    }, []);

    const fetchMyTasks = async () => {
        setLoading(true);
        try {
            const res = await api.get('/bgv/tasks/my-tasks');
            setTasks(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
            showToast('error', 'Error', 'Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const filteredTasks = tasks.filter(task => {
        if (filter === 'all') return true;
        return task.taskStatus === filter;
    });

    const getStatusBadge = (status) => {
        const styles = {
            ASSIGNED: 'bg-blue-50 text-blue-600 border-blue-100',
            IN_PROGRESS: 'bg-amber-50 text-amber-600 border-amber-100',
            COMPLETED: 'bg-purple-50 text-purple-600 border-purple-100',
            APPROVED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            REJECTED: 'bg-rose-50 text-rose-600 border-rose-100',
            ESCALATED: 'bg-orange-50 text-orange-600 border-orange-100'
        };
        return styles[status] || 'bg-slate-50 text-slate-500 border-slate-100';
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'ASSIGNED': return <Clock size={14} />;
            case 'IN_PROGRESS': return <AlertCircle size={14} />;
            case 'COMPLETED': return <CheckSquare size={14} />;
            case 'APPROVED': return <CheckCircle size={14} />;
            case 'REJECTED': return <XCircle size={14} />;
            default: return <FileText size={14} />;
        }
    };

    const getSLAStatus = (deadline) => {
        const now = dayjs();
        const slaDate = dayjs(deadline);
        const hoursLeft = slaDate.diff(now, 'hours');

        if (hoursLeft < 0) return { text: 'BREACHED', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' };
        if (hoursLeft < 24) return { text: 'CRITICAL', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' };
        if (hoursLeft < 48) return { text: 'WARNING', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' };
        return { text: 'ON TRACK', color: 'text-[#4F46E5]', bg: 'bg-indigo-50', border: 'border-indigo-100' };
    };

    return (
        <div className="p-6 w-full animate-in fade-in duration-700 font-sans selection:bg-indigo-100 selection:text-indigo-600 bg-slate-50/30 min-h-screen">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-indigo-50 text-[#4F46E5] rounded-lg text-[10px] font-semibold uppercase tracking-widest border border-indigo-100 mb-3">
                        <Target size={12} strokeWidth={2.5} /> TASK LIST
                    </div>
                    <h1 className="text-3xl font-semibold text-slate-900 tracking-tight leading-none mb-2">
                        MY <span className="text-[#4F46E5]">TASKS</span>
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm max-w-xl">
                        A simple view of all your assigned background checks and approvals.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-widest shadow-sm">
                        TOTAL TASKS: <span className="text-slate-900 ml-1">{tasks.length}</span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <StatCard
                    title="Assigned Tasks"
                    value={tasks.length}
                    icon={<ClipboardList size={22} />}
                    color="slate"
                />
                <StatCard
                    title="Awaiting Action"
                    value={tasks.filter(t => t.taskStatus === 'ASSIGNED').length}
                    icon={<Clock size={22} />}
                    color="amber"
                />
                <StatCard
                    title="Ready for Review"
                    value={tasks.filter(t => t.taskStatus === 'COMPLETED').length}
                    icon={<CheckSquare size={22} />}
                    color="purple"
                />
                <StatCard
                    title="Total Approved"
                    value={tasks.filter(t => t.taskStatus === 'APPROVED').length}
                    icon={<CheckCircle size={22} />}
                    color="indigo"
                />
            </div>

            {/* Filters Bar */}
            <div className="bg-white rounded-[2rem] border border-slate-200/60 p-3 shadow-sm mb-8 flex flex-wrap items-center gap-2">
                {['all', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`h-10 px-5 rounded-xl font-semibold text-[10px] uppercase tracking-widest transition-all ${filter === status
                            ? 'bg-[#4F46E5] text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                            }`}
                    >
                        {status === 'all' ? 'All Tasks' : status.replace(/_/g, ' ')}
                    </button>
                ))}
            </div>

            {/* Tasks List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-dashed border-slate-200 animate-pulse">
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-500/10 border-t-[#4F46E5] animate-spin mb-4"></div>
                    <p className="text-[10px] font-semibold text-[#4F46E5] uppercase tracking-widest">Loading Tasks...</p>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-slate-100 shadow-sm text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-6 transition-transform group-hover:scale-110">
                        <CheckSquare size={32} />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2 tracking-tight">No Pending Tasks</h3>
                    <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">
                        You have no tasks for <span className="text-[#4F46E5]">{filter === 'all' ? 'all' : filter.toLowerCase().replace(/_/g, ' ')}</span> right now.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredTasks.map((task, idx) => {
                        const slaStatus = getSLAStatus(task.slaDeadline);
                        const statusStyles = getStatusBadge(task.taskStatus);
                        return (
                            <div
                                key={task._id}
                                className="group bg-white rounded-[2.5rem] border border-slate-200/60 p-6 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                                    <FileText size={80} />
                                </div>

                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full border ${statusStyles}`}>
                                        {getStatusIcon(task.taskStatus)}
                                        {task.taskStatus.replace(/_/g, ' ')}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${slaStatus.bg} ${slaStatus.color} ${slaStatus.border}`}>
                                        {slaStatus.text}
                                    </span>
                                </div>

                                <h3 className="text-lg font-semibold text-slate-900 mb-2 leading-tight relative z-10 group-hover:text-[#4F46E5] transition-colors">
                                    {task.taskType?.replace(/_/g, ' ')}
                                </h3>

                                <div className="flex items-center gap-2 mb-4 relative z-10">
                                    <span className="text-[10px] font-bold text-[#4F46E5] bg-indigo-50 px-2 py-0.5 rounded uppercase font-mono tracking-tighter">
                                        {task.caseId}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest border-l border-slate-200 pl-2">
                                        {task.checkType?.replace(/_/g, ' ')}
                                    </span>
                                </div>

                                <p className="text-slate-500 text-xs font-medium mb-6 line-clamp-2 min-h-[32px] relative z-10">
                                    {task.instructions || 'Standard verification guidelines apply for this case check.'}
                                </p>

                                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 mb-6 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-[10px] font-semibold border-2 border-white">
                                            {task.caseId.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Priority</p>
                                            <p className={`text-[10px] font-bold uppercase ${task.priority === 'HIGH' ? 'text-rose-500' : task.priority === 'MEDIUM' ? 'text-amber-500' : 'text-slate-500'}`}>
                                                {task.priority || 'NORMAL'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1 text-right">Deadline</p>
                                        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter">
                                            {dayjs(task.slaDeadline).format('MMM DD, YYYY')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2 relative z-10">
                                    {task.taskStatus === 'ASSIGNED' && (
                                        <button
                                            onClick={() => {
                                                setSelectedTask(task);
                                                setShowCompleteModal(true);
                                            }}
                                            className="flex-1 h-10 px-4 bg-[#4F46E5] text-white rounded-xl font-semibold text-[10px] uppercase tracking-widest hover:bg-[#0ea5e9] transition-all shadow-sm flex items-center justify-center gap-2"
                                        >
                                            <CheckSquare size={14} strokeWidth={2.5} />
                                            Process
                                        </button>
                                    )}
                                    {task.taskStatus === 'COMPLETED' && task.maker?.userId !== task.assignedTo && (
                                        <button
                                            onClick={() => {
                                                setSelectedTask(task);
                                                setShowApproveModal(true);
                                            }}
                                            className="flex-1 h-10 px-4 bg-emerald-500 text-white rounded-xl font-semibold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={14} strokeWidth={2.5} />
                                            Approve
                                        </button>
                                    )}
                                    <button
                                        onClick={() => window.location.href = `/hr/bgv-case/${task.caseId}`}
                                        className="h-10 px-4 border border-slate-200 text-slate-400 rounded-xl font-semibold text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:text-slate-600 transition-all flex items-center justify-center gap-2 group-hover:border-indigo-100"
                                    >
                                        Case Detail
                                        <ChevronRight size={14} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const StatCard = ({ title, value, icon, color }) => {
    const colorStyles = {
        indigo: 'bg-indigo-50 text-[#4F46E5] border-indigo-100',
        amber: 'bg-amber-50 text-amber-500 border-amber-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        slate: 'bg-slate-50 text-slate-500 border-slate-100'
    };

    return (
        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4 group hover:border-indigo-200 transition-all duration-300">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${colorStyles[color]}`}>
                {icon}
            </div>
            <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block mb-1">{title}</span>
                <span className="text-2xl font-semibold text-slate-900 leading-none">{value}</span>
            </div>
        </div>
    );
};

export default MyTasks;
