import { useEffect, useState } from 'react';
import onboardingService from '../../services/onboardingService';
import './OnboardingWorkspace.css';

const columns = [
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
];

export default function OnboardingTaskBoard() {
  const [tasks, setTasks] = useState([]);

  const load = () => onboardingService.getTaskBoard().then((data) => setTasks(data.tasks || []));
  useEffect(() => { load(); }, []);

  const moveTask = async (task, status) => {
    await onboardingService.updateTask(task._id, { status });
    await load();
  };

  return (
    <div className="onb-shell rounded-[28px] p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900">Task board</h2>
        <p className="text-sm text-slate-500">Kanban-style execution board for HR, IT, manager, and employee onboarding tasks.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => (
          <div key={column.key} className="onb-card rounded-[28px] p-4">
            <h3 className="mb-4 text-base font-black text-slate-900">{column.label}</h3>
            <div className="space-y-3">
              {tasks.filter((task) => task.status === column.key).map((task) => (
                <div key={task._id} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <h4 className="font-bold text-slate-900">{task.title}</h4>
                  <p className="mt-1 text-sm text-slate-500">{task.description || 'No description'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {column.key !== 'in_progress' && <button type="button" onClick={() => moveTask(task, 'in_progress')} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">Start</button>}
                    {column.key !== 'completed' && <button type="button" onClick={() => moveTask(task, 'completed')} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Complete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
