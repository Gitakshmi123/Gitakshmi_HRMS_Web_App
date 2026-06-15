import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, Trash2, Save, Check, Clock, Minus } from 'lucide-react';
import exitAPI from '../../services/exitAPI';
import toast from 'react-hot-toast';

const DEPARTMENTS = ['IT', 'Admin', 'Finance', 'HR', 'Operations', 'Legal', 'Other'];

const DEPT_COLORS = {
    IT:         { bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-700 dark:text-blue-300',    border: 'border-blue-200 dark:border-blue-800'    },
    Admin:      { bg: 'bg-purple-50 dark:bg-purple-900/20',text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
    Finance:    { bg: 'bg-emerald-50 dark:bg-emerald-900/20',text:'text-emerald-700 dark:text-emerald-300',border:'border-emerald-200 dark:border-emerald-800'},
    HR:         { bg: 'bg-indigo-50 dark:bg-indigo-900/20',    text: 'text-indigo-700 dark:text-indigo-300',    border: 'border-indigo-200 dark:border-indigo-800'    },
    Operations: { bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-700 dark:text-amber-300',  border: 'border-amber-200 dark:border-amber-800'  },
    Legal:      { bg: 'bg-rose-50 dark:bg-rose-900/20',    text: 'text-rose-700 dark:text-rose-300',    border: 'border-rose-200 dark:border-rose-800'    },
    Other:      { bg: 'bg-slate-50 dark:bg-slate-800',     text: 'text-slate-700 dark:text-slate-300',  border: 'border-slate-200 dark:border-slate-700'  },
};

/**
 * HR department exit task management panel.
 * Groups tasks by department. HR can toggle status, add/remove tasks.
 */
export default function DepartmentTasksPanel({ request, onUpdate }) {
    const [tasks, setTasks]     = useState([]);
    const [newTask, setNewTask] = useState({ department: 'IT', task: '' });
    const [saving, setSaving]   = useState(false);

    useEffect(() => {
        if (request.departmentTasks?.length) {
            setTasks(request.departmentTasks.map(t => ({ ...t })));
        }
    }, [request._id]); // eslint-disable-line

    const grouped = DEPARTMENTS.reduce((acc, dept) => {
        const deptTasks = tasks.filter(t => t.department === dept);
        if (deptTasks.length) acc[dept] = deptTasks;
        return acc;
    }, {});

    const cycleStatus = (idx) => {
        setTasks(prev => prev.map((t, i) => {
            if (i !== idx) return t;
            const next = { Pending: 'Completed', Completed: 'NA', NA: 'Pending' }[t.status] || 'Pending';
            return { ...t, status: next, completedAt: next === 'Completed' ? new Date().toISOString() : undefined };
        }));
    };

    const removeTask = (idx) => setTasks(prev => prev.filter((_, i) => i !== idx));

    const addTask = () => {
        if (!newTask.task.trim()) return;
        setTasks(prev => [...prev, { ...newTask, status: 'Pending' }]);
        setNewTask(p => ({ ...p, task: '' }));
    };

    const save = async () => {
        try {
            setSaving(true);
            await exitAPI.updateTasks(request._id, tasks);
            toast.success('Department tasks saved.');
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to save tasks.');
        } finally {
            setSaving(false);
        }
    };

    const total     = tasks.length;
    const done      = tasks.filter(t => t.status !== 'Pending').length;
    const pct       = total > 0 ? Math.round((done / total) * 100) : 0;

    if (request.stage !== 'Clearance') return null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
                        <CheckSquare size={16} className="text-violet-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Department Exit Tasks</h3>
                        <p className="text-xs text-slate-500">{done}/{total} completed</p>
                    </div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">{pct}%</span>
                </div>
            </div>

            <div className="p-6 space-y-5">
                {/* Grouped tasks */}
                {Object.entries(grouped).map(([dept, deptTasks]) => {
                    const c = DEPT_COLORS[dept] || DEPT_COLORS.Other;
                    return (
                        <div key={dept}>
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide mb-2 ${c.bg} ${c.text} border ${c.border}`}>
                                {dept}
                            </div>
                            <div className="space-y-1.5">
                                {deptTasks.map((t) => {
                                    const globalIdx = tasks.findIndex(x => x === t || (x.department === t.department && x.task === t.task && x._id === t._id));
                                    return (
                                        <div key={t._id || t.task} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                                            ${t.status === 'Completed' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' :
                                              t.status === 'NA'        ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60' :
                                                                          'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                                        >
                                            {/* Status toggle */}
                                            <button onClick={() => cycleStatus(globalIdx)}
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all border-2
                                                    ${t.status === 'Completed' ? 'bg-emerald-500 border-emerald-500 text-white' :
                                                      t.status === 'NA'        ? 'bg-slate-300 border-slate-300 text-white' :
                                                                                  'border-slate-300 dark:border-slate-600 hover:border-violet-400'}`}
                                                title="Click to cycle: Pending → Completed → N/A"
                                            >
                                                {t.status === 'Completed' ? <Check size={13} strokeWidth={3} /> :
                                                 t.status === 'NA'        ? <Minus size={13} strokeWidth={3} /> :
                                                                             <Clock size={12} />}
                                            </button>

                                            <span className={`flex-1 text-sm font-medium ${t.status !== 'Pending' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {t.task}
                                            </span>

                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' :
                                                t.status === 'NA'        ? 'bg-slate-200 text-slate-500 dark:bg-slate-700' :
                                                                            'bg-amber-50 text-amber-600 dark:bg-amber-900/20'}`}
                                            >
                                                {t.status}
                                            </span>

                                            <button onClick={() => removeTask(globalIdx)}
                                                className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {tasks.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No tasks added yet. Add department tasks below.</p>
                )}

                {/* Add task */}
                <div className="flex gap-2 pt-1">
                    <select
                        value={newTask.department}
                        onChange={e => setNewTask(p => ({ ...p, department: e.target.value }))}
                        className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-violet-400 outline-none"
                    >
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input
                        type="text"
                        value={newTask.task}
                        onChange={e => setNewTask(p => ({ ...p, task: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addTask()}
                        placeholder="Add a new task..."
                        className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-violet-400 outline-none"
                    />
                    <button onClick={addTask} disabled={!newTask.task.trim()}
                        className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-violet-600 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-40"
                    >
                        <Plus size={14} /> Add
                    </button>
                </div>

                <p className="text-[11px] text-slate-400">Click a task's status icon to cycle: Pending → Completed → N/A</p>

                <button onClick={save} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-lg shadow-sm shadow-violet-500/25 disabled:opacity-50 transition-colors"
                >
                    <Save size={14} /> {saving ? 'Saving...' : 'Save All Tasks'}
                </button>
            </div>
        </div>
    );
}
