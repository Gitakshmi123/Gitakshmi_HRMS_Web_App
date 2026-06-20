import React, { useState } from 'react';
import { Tabs } from 'antd';
import { LayoutDashboard, Clock, FileJson, Key, ShieldCheck, UserCheck, CalendarDays, Workflow, BarChart3, History, LineChart } from 'lucide-react';
import ShiftMasterTab from './ShiftMasterTab';
import RuleBuilderTab from './RuleBuilderTab';
import PolicyManagementTab from './PolicyManagementTab';
import ShiftAssignmentTab from './ShiftAssignmentTab';
import SimulationCenterTab from './SimulationCenterTab';
import RosterManagementTab from './RosterManagementTab';
import WorkflowApprovalsTab from './WorkflowApprovalsTab';
import AuditReplayTab from './AuditReplayTab';
import AnalyticsTab from './AnalyticsTab';

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
      children: <RosterManagementTab />
    },
    {
      key: '7',
      label: <span className="flex items-center gap-2"><ShieldCheck size={16} /> Policy Management</span>,
      children: <PolicyManagementTab />
    },
    {
      key: '8',
      label: <span className="flex items-center gap-2"><Workflow size={16} /> Workflow & Approvals</span>,
      children: <WorkflowApprovalsTab />
    },
    {
      key: '9',
      label: <span className="flex items-center gap-2"><BarChart3 size={16} /> Simulation Center</span>,
      children: <SimulationCenterTab />
    },
    {
      key: '10',
      label: <span className="flex items-center gap-2"><History size={16} /> Audit Replay</span>,
      children: <AuditReplayTab />
    },
    {
      key: '11',
      label: <span className="flex items-center gap-2"><LineChart size={16} /> Analytics</span>,
      children: <AnalyticsTab />
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
