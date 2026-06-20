import React, { useState } from 'react';
import { Tabs } from 'antd';
import { LayoutDashboard, Clock, FileJson, Key, ShieldCheck, UserCheck, CalendarDays, Workflow, BarChart3, RotateCcw } from 'lucide-react';
import ShiftMasterTab from './ShiftMasterTab';
import RuleBuilderTab from './RuleBuilderTab';
import PolicyManagementTab from './PolicyManagementTab';
import ShiftAssignmentTab from './ShiftAssignmentTab';
import SimulationCenterTab from './SimulationCenterTab';

export default function ShiftManagement() {
  const [activeTab, setActiveTab] = useState('1');

  const tabItems = [
    {
      key: '1',
      label: <span className="flex items-center gap-2"><LayoutDashboard size={16} /> Shift Master</span>,
      children: <ShiftMasterTab />
    },
    {
      key: '2',
      label: <span className="flex items-center gap-2"><FileJson size={16} /> Rule Builder</span>,
      children: <RuleBuilderTab />
    },
    {
      key: '5',
      label: <span className="flex items-center gap-2"><UserCheck size={16} /> Shift Assignment</span>,
      children: <ShiftAssignmentTab />
    },
    {
      key: '6',
      label: <span className="flex items-center gap-2"><CalendarDays size={16} /> Roster Management</span>,
      children: <div className="p-4"><h2 className="text-lg font-semibold">Roster Management (Coming Phase 4)</h2></div>
    },
    {
      key: '7',
      label: <span className="flex items-center gap-2"><ShieldCheck size={16} /> Policy Management</span>,
      children: <PolicyManagementTab />
    },
    {
      key: '8',
      label: <span className="flex items-center gap-2"><Workflow size={16} /> Workflow & Approvals</span>,
      children: <div className="p-4"><h2 className="text-lg font-semibold">Workflow & Approvals (Coming Phase 4)</h2></div>
    },
    {
      key: '9',
      label: <span className="flex items-center gap-2"><BarChart3 size={16} /> Simulation Center</span>,
      children: <SimulationCenterTab />
    },
    {
      key: '10',
      label: <span className="flex items-center gap-2"><RotateCcw size={16} /> Audit Replay</span>,
      children: <div className="p-4"><h2 className="text-lg font-semibold">Audit Replay (Coming Phase 3)</h2></div>
    },
    {
      key: '11',
      label: <span className="flex items-center gap-2"><BarChart3 size={16} /> Analytics</span>,
      children: <div className="p-4"><h2 className="text-lg font-semibold">Analytics (Coming Phase 5)</h2></div>
    }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enterprise Shift Management</h1>
          <p className="text-sm text-slate-500 mt-1">Configure dynamic shift rules, overtime, permissions, and simulate policies.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          tabPosition="left" 
          className="min-h-[600px]"
          items={tabItems}
        />
      </div>
    </div>
  );
}
