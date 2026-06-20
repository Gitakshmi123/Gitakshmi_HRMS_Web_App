import React, { useState } from 'react';
import { Tabs } from 'antd';
import { 
  LayoutDashboard, FileJson, UserCheck, CalendarDays, ShieldCheck, 
  Workflow, BarChart3, History, LineChart, Sparkles 
} from 'lucide-react';
import ShiftMasterTab from './ShiftMasterTab';
import RuleBuilderTab from './RuleBuilderTab';
import PolicyManagementTab from './PolicyManagementTab';
import ShiftAssignmentTab from './ShiftAssignmentTab';
import RosterManagementTab from './RosterManagementTab';
import WorkflowApprovalsTab from './WorkflowApprovalsTab';
import AuditReplayTab from './AuditReplayTab';
import AnalyticsTab from './AnalyticsTab';

export default function ShiftManagement() {
  const [activeTab, setActiveTab] = useState('1');

  const tabItems = [
    {
      key: '1',
      label: <span className="flex items-center gap-2 font-medium px-2 py-1.5"><LayoutDashboard size={16} /> Shift Configuration</span>,
      children: <ShiftMasterTab />
    },
    {
      key: '2',
      label: <span className="flex items-center gap-2 font-medium px-2 py-1.5"><FileJson size={16} /> Attendance Calculation Rule</span>,
      children: <RuleBuilderTab activeShiftId={null} />
    },
    {
      key: '3',
      label: <span className="flex items-center gap-2 font-medium px-2 py-1.5"><UserCheck size={16} /> Shift Assignment</span>,
      children: <ShiftAssignmentTab />
    },
    {
      key: '4',
      label: <span className="flex items-center gap-2 font-medium px-2 py-1.5"><CalendarDays size={16} /> Roster Management</span>,
      children: <RosterManagementTab />
    },
    {
      key: '5',
      label: <span className="flex items-center gap-2 font-medium px-2 py-1.5"><ShieldCheck size={16} /> Policy Management</span>,
      children: <PolicyManagementTab />
    },
    {
      key: '6',
      label: <span className="flex items-center gap-2 font-medium px-2 py-1.5"><Workflow size={16} /> Workflow & Approvals</span>,
      children: <WorkflowApprovalsTab />
    },
    {
      key: '8',
      label: <span className="flex items-center gap-2 font-medium px-2 py-1.5"><History size={16} /> Audit Replay</span>,
      children: <AuditReplayTab />
    },
    {
      key: '9',
      label: <span className="flex items-center gap-2 font-medium px-2 py-1.5"><LineChart size={16} /> Analytics</span>,
      children: <AnalyticsTab />
    }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Sparkles size={20} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Attendance Configuration Master</h1>
          </div>
          <p className="text-slate-500 mt-1 ml-14 max-w-full whitespace-nowrap overflow-hidden text-ellipsis text-sm leading-relaxed">
            Configure dynamic shift rules, setup advanced overtime calculations, manage permissions, and simulate policies with our next-gen scheduling engine.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 shift-management-tabs">
        <style dangerouslySetInnerHTML={{__html: `
          .shift-management-tabs .ant-tabs-nav {
            background: #f8fafc;
            border-radius: 12px;
            padding: 8px;
            margin-right: 24px !important;
          }
          .shift-management-tabs .ant-tabs-tab {
            margin: 4px 0 !important;
            border-radius: 8px;
            transition: all 0.2s;
          }
          .shift-management-tabs .ant-tabs-tab:hover {
            background: #f1f5f9;
          }
          .shift-management-tabs .ant-tabs-tab-active {
            background: white !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          .shift-management-tabs .ant-tabs-ink-bar {
            display: none !important;
          }
        `}} />
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          tabPosition="left" 
          className="min-h-[600px]"
          items={tabItems}
          destroyInactiveTabPane={false}
        />
      </div>
    </div>
  );
}
