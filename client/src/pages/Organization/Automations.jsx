import React, { useState, useEffect } from 'react';
import { Alert, Card, Table, Button, Switch, Space, message, Input, InputNumber, Select, Badge } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  GitFork,
  Mail,
  UserCheck,
  Globe,
  CheckSquare,
  Plus,
  Trash2,
  ChevronDown,
  ArrowLeft,
  Play,
  AlertCircle,
  HelpCircle,
  Check,
  ChevronUp,
  Settings,
  Info
} from 'lucide-react';
import api from '../../utils/api';

const { Option } = Select;

const APPROVER_OPTIONS = [
  { value: 'REPORTING_MANAGER', label: 'Reporting Manager' },
  { value: 'MANAGER_MANAGER', label: 'Manager Manager' },
  { value: 'DEPARTMENT_HEAD', label: 'Department Head' },
  { value: 'BRANCH_HEAD', label: 'Branch Head' },
  { value: 'DIVISION_HEAD', label: 'Division Head' },
  { value: 'HR_HEAD', label: 'HR Head' },
  { value: 'HR', label: 'HR Team' },
  { value: 'CEO', label: 'CEO / Director' },
  { value: 'ROLE', label: 'Custom Role' }
];

const defaultApprovalSteps = () => ([
  {
    key: 'reporting_manager_approval',
    name: 'Reporting Manager Approval',
    approverType: 'REPORTING_MANAGER',
    approverValue: 'REPORTING_MANAGER',
    approvalMode: 'ANY',
    minApprovals: 1,
    slaHours: 24,
    emailTriggerType: '',
    emailToField: 'assignee.email'
  }
]);

const defaultActionConfig = (type) => ({
  SEND_EMAIL: { triggerType: '', toEmailField: 'employee.email' },
  TRIGGER_APPROVAL: {
    moduleKey: 'leave',
    entityType: 'LeaveRequest',
    requesterEmployeeField: 'employeeId',
    workflowName: 'Leave Approval Automation',
    approvalSteps: defaultApprovalSteps()
  },
  WEBHOOK: { url: '', payloadJson: '{}' },
  ASSIGN_TASK: { taskName: '', description: '', assigneeField: 'employeeId' }
}[type] || {});

export default function Automations() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Visual Builder States
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderId, setBuilderId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [triggerEvent, setTriggerEvent] = useState('LEAVE_REQUESTED');
  const [conditions, setConditions] = useState([]);
  const [actions, setActions] = useState([]);

  // Selected Node for parameters inspector
  const [selectedNode, setSelectedNode] = useState(null); // { type: 'trigger' | 'condition' | 'action', index?: number }
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    fetchAutomations();
    fetchEmailTemplates();
  }, []);

  const fetchAutomations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/automations');
      if (data.success) {
        setAutomations(data.automations);
      }
    } catch (err) {
      message.error('Failed to fetch automations');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const { data } = await api.get('/email-templates');
      if (data && Array.isArray(data)) {
        setEmailTemplates(data);
      } else if (data?.templates) {
        setEmailTemplates(data.templates);
      }
    } catch (_) {
      // SMTP template fetch is best effort
    }
  };

  const openVisualBuilder = (record = null) => {
    if (record) {
      setBuilderId(record._id);
      setName(record.name || '');
      setDescription(record.description || '');
      setIsActive(record.isActive !== false);
      setTriggerEvent(record.triggerEvent || 'LEAVE_REQUESTED');
      setConditions(record.conditions?.length ? record.conditions : []);
      setActions(record.actions?.length ? record.actions.sort((a, b) => (a.order || 0) - (b.order || 0)) : []);
      setSelectedNode({ type: 'trigger' });
    } else {
      setBuilderId(null);
      setName('');
      setDescription('');
      setIsActive(true);
      setTriggerEvent('LEAVE_REQUESTED');
      setConditions([]);
      setActions([
        {
          type: 'TRIGGER_APPROVAL',
          config: defaultActionConfig('TRIGGER_APPROVAL'),
          order: 1
        }
      ]);
      setSelectedNode({ type: 'trigger' });
    }
    setIsBuilderOpen(true);
  };

  const closeVisualBuilder = () => {
    setIsBuilderOpen(false);
    setBuilderId(null);
    setSelectedNode(null);
  };

  const handleSaveWorkflow = async () => {
    if (!name.trim()) {
      message.error('Please enter a workflow name');
      return;
    }
    if (!triggerEvent) {
      message.error('Please configure a Trigger Event');
      return;
    }

    // Prepare actions order and payload
    const orderedActions = actions.map((act, idx) => ({
      ...act,
      order: idx + 1
    }));

    const payload = {
      name,
      description,
      isActive,
      triggerEvent,
      conditions: conditions.filter(c => c.field && c.operator),
      actions: orderedActions.filter(a => a.type),
      visualLayout: {
        selectedNode,
        conditionsCount: conditions.length,
        actionsCount: actions.length
      }
    };

    try {
      if (builderId) {
        await api.put(`/automations/${builderId}`, payload);
        message.success('Workflow updated successfully');
      } else {
        await api.post('/automations', payload);
        message.success('Workflow created successfully');
      }
      closeVisualBuilder();
      fetchAutomations();
    } catch (err) {
      message.error('Failed to save workflow automation');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/automations/${id}`);
      message.success('Workflow deleted successfully');
      fetchAutomations();
    } catch (err) {
      message.error('Failed to delete workflow');
    }
  };

  // Node Drag & Drop Logic
  const handleDragStart = (e, actionType) => {
    e.dataTransfer.setData('actionType', actionType);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const actionType = e.dataTransfer.getData('actionType');
    if (actionType) {
      addNewAction(actionType);
    }
  };

  const addNewAction = (type) => {
    const newAction = {
      type,
      config: defaultActionConfig(type),
      order: actions.length + 1
    };

    const newActions = [...actions, newAction];
    setActions(newActions);
    setSelectedNode({ type: 'action', index: newActions.length - 1 });
  };

  const deleteAction = (index, e) => {
    e.stopPropagation();
    const updated = actions.filter((_, i) => i !== index).map((act, i) => ({ ...act, order: i + 1 }));
    setActions(updated);
    if (selectedNode?.type === 'action' && selectedNode.index === index) {
      setSelectedNode({ type: 'trigger' });
    } else if (selectedNode?.type === 'action' && selectedNode.index > index) {
      setSelectedNode({ type: 'action', index: selectedNode.index - 1 });
    }
  };

  const moveAction = (index, direction, e) => {
    e.stopPropagation();
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === actions.length - 1) return;

    const newActions = [...actions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;

    // Swap
    const temp = newActions[index];
    newActions[index] = newActions[targetIdx];
    newActions[targetIdx] = temp;

    // Fix orders
    const finalActions = newActions.map((act, idx) => ({ ...act, order: idx + 1 }));
    setActions(finalActions);

    if (selectedNode?.type === 'action' && selectedNode.index === index) {
      setSelectedNode({ type: 'action', index: targetIdx });
    } else if (selectedNode?.type === 'action' && selectedNode.index === targetIdx) {
      setSelectedNode({ type: 'action', index: index });
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
    setSelectedNode({ type: 'condition' });
  };

  const removeCondition = (idx) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx, key, val) => {
    const updated = [...conditions];
    updated[idx] = { ...updated[idx], [key]: val };
    setConditions(updated);
  };

  const updateActionConfig = (index, key, val) => {
    const updated = [...actions];
    updated[index].config = { ...updated[index].config, [key]: val };
    setActions(updated);
  };

  const getApprovalSteps = (index) => (
    actions[index]?.config?.approvalSteps?.length
      ? actions[index].config.approvalSteps
      : defaultApprovalSteps()
  );

  const updateApprovalStep = (actionIndex, stepIndex, key, val) => {
    const updated = [...actions];
    const steps = getApprovalSteps(actionIndex).map((step, idx) => (
      idx === stepIndex ? { ...step, [key]: val } : step
    ));
    updated[actionIndex].config = { ...updated[actionIndex].config, approvalSteps: steps };
    setActions(updated);
  };

  const addApprovalStep = (actionIndex) => {
    const updated = [...actions];
    const steps = getApprovalSteps(actionIndex);
    const nextOrder = steps.length + 1;
    updated[actionIndex].config = {
      ...updated[actionIndex].config,
      approvalSteps: [
        ...steps,
        {
          key: `approval_phase_${nextOrder}`,
          name: `Approval Phase ${nextOrder}`,
          approverType: nextOrder === 2 ? 'DEPARTMENT_HEAD' : 'HR_HEAD',
          approverValue: nextOrder === 2 ? 'DEPARTMENT_HEAD' : 'HR_HEAD',
          approvalMode: 'ANY',
          minApprovals: 1,
          slaHours: 24,
          emailTriggerType: '',
          emailToField: 'assignee.email'
        }
      ]
    };
    setActions(updated);
  };

  const removeApprovalStep = (actionIndex, stepIndex) => {
    const updated = [...actions];
    const steps = getApprovalSteps(actionIndex).filter((_, idx) => idx !== stepIndex);
    updated[actionIndex].config = {
      ...updated[actionIndex].config,
      approvalSteps: steps.length ? steps : defaultApprovalSteps()
    };
    setActions(updated);
  };

  const updateActionType = (index, val) => {
    const updated = [...actions];
    updated[index].type = val;
    updated[index].config = defaultActionConfig(val);
    setActions(updated);
  };

  const columns = [
    {
      title: 'Workflow Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div className="font-bold text-gray-800">{text}</div>
          {record.description && <div className="text-xs text-gray-500 mt-0.5">{record.description}</div>}
        </div>
      )
    },
    {
      title: 'Trigger Event',
      dataIndex: 'triggerEvent',
      key: 'triggerEvent',
      render: (val) => (
        <Badge status="processing" text={
          {
            LEAVE_REQUESTED: 'Leave Requested',
            LEAVE_APPROVED: 'Leave Approved',
            LEAVE_REJECTED: 'Leave Rejected',
            EMPLOYEE_JOINED: 'Employee Joined',
            OFFER_LETTER_REQUESTED: 'Offer Letter Requested',
            TICKET_CREATED: 'Ticket Created'
          }[val] || val
        } />
      )
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val, record) => (
        <Switch
          checked={val}
          onChange={async (checked) => {
            try {
              await api.put(`/automations/${record._id}`, { ...record, isActive: checked });
              message.success('Status updated successfully');
              fetchAutomations();
            } catch (err) {
              message.error('Failed to toggle active status');
            }
          }}
        />
      )
    },
    {
      title: 'Conditions Count',
      key: 'conditions',
      render: (_, record) => record.conditions?.length || 'Apply to All'
    },
    {
      title: 'Action Flow Steps',
      key: 'actions',
      render: (_, record) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(record.actions || []).sort((a,b)=>a.order-b.order).map((act, i) => {
            const label = {
              SEND_EMAIL: 'Send Email',
              TRIGGER_APPROVAL: 'Approval Request',
              WEBHOOK: 'Webhook',
              ASSIGN_TASK: 'Task'
            }[act.type] || act.type;
            const color = {
              SEND_EMAIL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              TRIGGER_APPROVAL: 'bg-indigo-50 text-indigo-700 border-indigo-200',
              WEBHOOK: 'bg-blue-50 text-blue-700 border-blue-200',
              ASSIGN_TASK: 'bg-cyan-50 text-cyan-700 border-cyan-200'
            }[act.type] || 'bg-gray-50 text-gray-700';
            return (
              <span key={i} className={`text-xs px-2 py-0.5 border rounded-full font-medium ${color}`}>
                {act.order}. {label}
              </span>
            );
          })}
        </div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="primary" size="small" ghost onClick={() => openVisualBuilder(record)}>
            Edit
          </Button>
          <Button danger type="primary" size="small" ghost onClick={() => handleDelete(record._id)}>
            Delete
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 min-h-screen bg-slate-50/50">
      <AnimatePresence mode="wait">
        {!isBuilderOpen ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Automation Engine</h1>
                <p className="text-gray-500 text-sm mt-0.5">Design visually premium drag-and-drop workflow charts, set custom condition gates, and route hierarchy activities.</p>
              </div>
              <Button type="primary" className="bg-indigo-600 hover:bg-indigo-700 border-none h-10 px-6 rounded-lg font-medium shadow-sm flex items-center gap-1.5" onClick={() => openVisualBuilder()}>
                <Plus className="w-4.5 h-4.5" /> Create Workflow
              </Button>
            </div>

            <Alert
              message={
                <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                  <Info className="w-5 h-5 text-indigo-600" /> System Manual: Managing Activity Automations
                </span>
              }
              description={
                <div className="mt-1 text-sm text-gray-600 leading-relaxed">
                  Assign dynamic approval routing workflows directly inside automations. By configuring a <strong className="text-indigo-700">Trigger Approval Step</strong>, activities like leave requests are sent to managers, department heads, and role aliases automatically.
                </div>
              }
              type="info"
              className="mb-6 border-indigo-100 bg-indigo-50/40 rounded-xl"
            />

            <Card className="rounded-xl border-slate-100 shadow-sm overflow-hidden">
              <Table
                dataSource={automations}
                columns={columns}
                rowKey="_id"
                loading={loading}
                pagination={{ pageSize: 8 }}
                className="custom-table"
              />
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="builder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
          >
            {/* Builder Header */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={closeVisualBuilder}
                  className="text-slate-500 hover:text-slate-800 transition p-1.5 rounded-lg hover:bg-slate-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex flex-col">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Workflow Name (e.g., Leave Approval Flow)"
                    className="bg-transparent border-none outline-none font-bold text-lg text-slate-800 placeholder-slate-400 w-80 focus:ring-0 focus:border-b focus:border-slate-300 py-0"
                  />
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description of this automation..."
                    className="bg-transparent border-none outline-none text-xs text-slate-500 placeholder-slate-400 w-96 py-0 mt-0.5 focus:ring-0"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">ACTIVE STATUS</span>
                  <Switch checked={isActive} onChange={setIsActive} className="bg-slate-600" />
                </div>
                <button
                  onClick={handleSaveWorkflow}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2 rounded-lg transition-all shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4.5 h-4.5" /> Save Workflow
                </button>
              </div>
            </div>

            {/* Builder Workspace */}
            <div className="flex flex-1 overflow-hidden">

              {/* Left sidebar: Node palette */}
              <div className="w-72 bg-slate-50 border-r border-slate-200 p-5 flex flex-col gap-6 overflow-y-auto">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 tracking-wider mb-3 uppercase">Trigger Event</h3>
                  <div className="text-xs text-slate-500 mb-3 leading-relaxed">
                    Double-click the Trigger node in the canvas to select the event that starts this automation.
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 tracking-wider mb-3 uppercase">Condition Gates</h3>
                  <div
                    onClick={addCondition}
                    className="group border border-dashed border-amber-500/30 hover:border-amber-500/80 bg-amber-500/5 hover:bg-amber-500/10 p-3.5 rounded-xl cursor-pointer transition flex items-center gap-3 text-amber-400 select-none"
                  >
                    <div className="p-2 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30">
                      <GitFork className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Add Condition Gate</div>
                      <div className="text-[10px] text-amber-500/60 mt-0.5">Filter incoming activity rules</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 tracking-wider mb-3 uppercase">Drag Actions To Flow</h3>
                  <div className="flex flex-col gap-3">
                    {[
                      { type: 'TRIGGER_APPROVAL', label: 'Approval Step', desc: 'Route hierarchy approvals', icon: UserCheck, color: 'indigo' },
                      { type: 'SEND_EMAIL', label: 'Send Email', desc: 'Templated notification alert', icon: Mail, color: 'emerald' },
                      { type: 'WEBHOOK', label: 'Call Webhook', desc: 'Dispatch JSON to external API', icon: Globe, color: 'blue' },
                      { type: 'ASSIGN_TASK', label: 'Assign Task', desc: 'Assign generic activity task', icon: CheckSquare, color: 'cyan' }
                    ].map((item) => (
                      <div
                        key={item.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.type)}
                        className={`group border border-slate-700 bg-slate-800/50 hover:bg-slate-750 p-3.5 rounded-xl cursor-grab active:cursor-grabbing transition flex items-center gap-3 select-none hover:border-indigo-500/50`}
                      >
                        <div className={`p-2 rounded-lg bg-${item.color}-500/20 text-${item.color}-400 group-hover:scale-105 transition-transform`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-200">{item.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Center: Canvas */}
              <div
                className="flex-1 bg-slate-100 overflow-y-auto p-12 relative"
                style={{
                  backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
                  backgroundSize: '24px 24px'
                }}
              >
                <div className="max-w-2xl mx-auto flex flex-col items-center">

                  {/* Node 1: Trigger Event */}
                  <motion.div
                    onClick={() => setSelectedNode({ type: 'trigger' })}
                    className={`w-full max-w-lg bg-slate-800 border p-5 rounded-2xl shadow-lg cursor-pointer transition-all ${
                      selectedNode?.type === 'trigger'
                        ? 'border-indigo-500 shadow-indigo-500/10 ring-1 ring-indigo-500'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
                          <Zap className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">Trigger Event</div>
                          <div className="text-base font-bold text-white mt-0.5">
                            {
                              {
                                LEAVE_REQUESTED: 'When Leave is Requested',
                                LEAVE_APPROVED: 'When Leave is Approved',
                                LEAVE_REJECTED: 'When Leave is Rejected',
                                EMPLOYEE_JOINED: 'When Employee Joins',
                                OFFER_LETTER_REQUESTED: 'When Offer Letter is Requested',
                                TICKET_CREATED: 'When Support Ticket is Created'
                              }[triggerEvent] || triggerEvent
                            }
                          </div>
                        </div>
                      </div>
                      <div className="text-slate-500 hover:text-indigo-400 transition p-1 hover:bg-slate-700 rounded-lg">
                        <Settings className="w-4.5 h-4.5" />
                      </div>
                    </div>
                  </motion.div>

                  {/* Visual Connection line */}
                  <div className="flex flex-col items-center select-none py-1">
                    <div className="w-0.5 h-8 bg-indigo-500/30" />
                    <ChevronDown className="w-5 h-5 text-indigo-500/60 -mt-1" />
                  </div>

                  {/* Node 2: Conditions Gate */}
                  <motion.div
                    onClick={() => setSelectedNode({ type: 'condition' })}
                    className={`w-full max-w-lg bg-slate-800 border p-5 rounded-2xl shadow-lg cursor-pointer transition-all ${
                      selectedNode?.type === 'condition'
                        ? 'border-amber-500 shadow-amber-500/10 ring-1 ring-amber-500'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-amber-500 text-slate-950 rounded-xl shadow-md">
                          <GitFork className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">Condition Gate</div>
                          <div className="text-sm font-semibold text-slate-200 mt-1">
                            {conditions.length === 0 ? (
                              <span className="text-slate-400 text-xs italic">Apply to all activity rules (No Filters)</span>
                            ) : (
                              <div className="flex flex-col gap-1 text-xs text-amber-500/90 font-medium">
                                {conditions.map((c, i) => (
                                  <div key={i}>
                                    • {c.field} {c.operator.replace('_', ' ')} <strong className="text-white">"{c.value}"</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-slate-500 hover:text-amber-400 transition p-1 hover:bg-slate-700 rounded-lg">
                        <Plus className="w-4.5 h-4.5" />
                      </div>
                    </div>
                  </motion.div>

                  {/* Visual Connection line */}
                  <div className="flex flex-col items-center select-none py-1">
                    <div className="w-0.5 h-8 bg-indigo-500/30" />
                    <ChevronDown className="w-5 h-5 text-indigo-500/60 -mt-1" />
                  </div>

                  {/* Node 3: Actions Chain */}
                  <div className="w-full max-w-lg flex flex-col items-center">
                    {actions.map((act, index) => {
                      const Icon = {
                        SEND_EMAIL: Mail,
                        TRIGGER_APPROVAL: UserCheck,
                        WEBHOOK: Globe,
                        ASSIGN_TASK: CheckSquare
                      }[act.type] || HelpCircle;

                      const label = {
                        SEND_EMAIL: 'Send Email',
                        TRIGGER_APPROVAL: 'Trigger Approval Flow',
                        WEBHOOK: 'Call Webhook',
                        ASSIGN_TASK: 'Assign Task'
                      }[act.type] || act.type;

                      const themeColor = {
                        SEND_EMAIL: 'emerald',
                        TRIGGER_APPROVAL: 'indigo',
                        WEBHOOK: 'blue',
                        ASSIGN_TASK: 'cyan'
                      }[act.type] || 'slate';

                      const configSummary = {
                        SEND_EMAIL: `Template: ${act.config?.triggerType || 'None'} → ${act.config?.toEmailField || 'Default'}`,
                        TRIGGER_APPROVAL: `Route: ${act.config?.moduleKey?.toUpperCase() || 'LEAVE'} / Approver: Reporting Manager`,
                        WEBHOOK: `Post to: ${act.config?.url || 'No URL configured'}`,
                        ASSIGN_TASK: `Task: ${act.config?.taskName || 'Untitled Task'}`
                      }[act.type] || '';

                      const borderRing = selectedNode?.type === 'action' && selectedNode.index === index
                        ? `border-${themeColor}-500 ring-1 ring-${themeColor}-500`
                        : 'border-slate-700 hover:border-slate-600';

                      return (
                        <React.Fragment key={index}>
                          <motion.div
                            onClick={() => setSelectedNode({ type: 'action', index })}
                            className={`w-full bg-slate-800 border p-5 rounded-2xl shadow-lg cursor-pointer transition-all flex items-center justify-between ${borderRing}`}
                          >
                            <div className="flex items-center gap-3.5">
                              <div className={`p-3 bg-${themeColor}-500 text-white rounded-xl shadow-md`}>
                                <Icon className="w-6 h-6" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold tracking-wider uppercase text-${themeColor}-400`}>
                                    Action Step {index + 1}
                                  </span>
                                  <Badge count={label} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontSize: '9px', height: '16px', lineHeight: '14px' }} />
                                </div>
                                <div className="text-base font-bold text-white mt-0.5">{label}</div>
                                <div className="text-[11px] text-slate-400 mt-1 italic">{configSummary}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                disabled={index === 0}
                                onClick={(e) => moveAction(index, 'up', e)}
                                className="text-slate-500 hover:text-slate-200 transition p-1 hover:bg-slate-700 rounded-lg disabled:opacity-20"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                disabled={index === actions.length - 1}
                                onClick={(e) => moveAction(index, 'down', e)}
                                className="text-slate-500 hover:text-slate-200 transition p-1 hover:bg-slate-700 rounded-lg disabled:opacity-20"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => deleteAction(index, e)}
                                className="text-slate-500 hover:text-red-400 transition p-1 hover:bg-slate-700 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>

                          {/* Connection between actions */}
                          {index < actions.length - 1 && (
                            <div className="flex flex-col items-center select-none py-1">
                              <div className="w-0.5 h-8 bg-indigo-500/30" />
                              <ChevronDown className="w-5 h-5 text-indigo-500/60 -mt-1" />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Drag Drop target zone */}
                    <div className="flex flex-col items-center select-none py-1 w-full">
                      <div className="w-0.5 h-8 bg-indigo-500/30" />
                      <ChevronDown className="w-5 h-5 text-indigo-500/60 -mt-1" />
                    </div>

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`w-full border-2 border-dashed p-6 rounded-2xl flex flex-col items-center justify-center transition-all ${
                        isDraggingOver
                          ? 'border-indigo-400 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 text-slate-500 hover:text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Plus className={`w-8 h-8 ${isDraggingOver ? 'text-indigo-400 animate-bounce' : 'text-slate-600'}`} />
                      <div className="text-xs font-semibold mt-2">Drag & Drop action blocks here</div>
                      <div className="text-[10px] text-slate-600 mt-1">Or drag items from Left Panel to append steps</div>
                    </div>

                  </div>

                </div>
              </div>

              {/* Right Panel: Parameters Inspector Drawer */}
              <div className="w-80 bg-slate-50 border-l border-slate-200 p-5 overflow-y-auto flex flex-col">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-4 mb-4">
                  <Settings className="w-4.5 h-4.5 text-indigo-500" />
                  <h3 className="font-bold text-slate-800 text-sm">Parameters Inspector</h3>
                </div>

                {selectedNode?.type === 'trigger' && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1.5 uppercase">Trigger Event Type</label>
                      <Select
                        value={triggerEvent}
                        onChange={setTriggerEvent}
                        className="w-full custom-dark-select"
                        dropdownClassName="custom-dark-dropdown"
                      >
                        <Option value="LEAVE_REQUESTED">Leave Requested</Option>
                        <Option value="LEAVE_APPROVED">Leave Approved</Option>
                        <Option value="LEAVE_REJECTED">Leave Rejected</Option>
                        <Option value="EMPLOYEE_JOINED">Employee Joined</Option>
                        <Option value="OFFER_LETTER_REQUESTED">Offer Letter Requested</Option>
                        <Option value="TICKET_CREATED">Ticket Created</Option>
                      </Select>
                      <div className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                        When this event occurs in the HRMS application, it acts as the starting point and passes system data down the workflow.
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode?.type === 'condition' && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-bold text-slate-400 block uppercase">Filters list</label>
                        <button
                          onClick={addCondition}
                          className="text-xs text-amber-500 hover:text-amber-400 transition flex items-center gap-1 font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Rule
                        </button>
                      </div>

                      {conditions.length === 0 ? (
                        <div className="text-xs text-slate-500 leading-relaxed bg-slate-900/30 border border-slate-700/60 p-4 rounded-xl text-center italic">
                          No conditions set. This automation will trigger automatically for all requests.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {conditions.map((cond, idx) => (
                            <div key={idx} className="bg-slate-900/40 border border-slate-700/80 p-3 rounded-xl relative group">
                              <button
                                onClick={() => removeCondition(idx)}
                                className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              <div className="flex flex-col gap-2">
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-1">FIELD PATH</label>
                                  <Input
                                    size="small"
                                    value={cond.field}
                                    onChange={(e) => updateCondition(idx, 'field', e.target.value)}
                                    placeholder="e.g. leaveType or daysCount"
                                    className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-xs"
                                  />
                                </div>

                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-1">OPERATOR</label>
                                  <Select
                                    size="small"
                                    value={cond.operator}
                                    onChange={(val) => updateCondition(idx, 'operator', val)}
                                    className="w-full custom-dark-select text-xs"
                                  >
                                    <Option value="equals">Equals</Option>
                                    <Option value="not_equals">Not Equals</Option>
                                    <Option value="contains">Contains</Option>
                                    <Option value="greater_than">Greater Than</Option>
                                    <Option value="less_than">Less Than</Option>
                                  </Select>
                                </div>

                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-1">COMPARE VALUE</label>
                                  <Input
                                    size="small"
                                    value={cond.value}
                                    onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                                    placeholder="e.g. Sick or 3"
                                    className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedNode?.type === 'action' && (
                  <div className="flex flex-col gap-4">
                    {/* Action Class */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1.5 uppercase">Action Type</label>
                      <Select
                        value={actions[selectedNode.index]?.type}
                        onChange={(val) => updateActionType(selectedNode.index, val)}
                        className="w-full custom-dark-select"
                      >
                        <Option value="TRIGGER_APPROVAL">Trigger Approval Step</Option>
                        <Option value="SEND_EMAIL">Send Email Notification</Option>
                        <Option value="WEBHOOK">Call Webhook Link</Option>
                        <Option value="ASSIGN_TASK">Assign Generic Task</Option>
                      </Select>
                    </div>

                    {/* Action config: Send Email */}
                    {actions[selectedNode.index]?.type === 'SEND_EMAIL' && (
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Email template trigger</label>
                          <Select
                            value={actions[selectedNode.index]?.config?.triggerType}
                            onChange={(val) => updateActionConfig(selectedNode.index, 'triggerType', val)}
                            className="w-full custom-dark-select"
                            placeholder="Choose SMTP template"
                          >
                            {emailTemplates.map(t => (
                              <Option key={t._id} value={t.triggerType}>{t.name} ({t.triggerType})</Option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Send to (Email Field)</label>
                          <Input
                            value={actions[selectedNode.index]?.config?.toEmailField}
                            onChange={(e) => updateActionConfig(selectedNode.index, 'toEmailField', e.target.value)}
                            placeholder="e.g. employee.email"
                            className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action config: Trigger Approval */}
                    {actions[selectedNode.index]?.type === 'TRIGGER_APPROVAL' && (
                      <div className="flex flex-col gap-3 border-t border-slate-700/40 pt-3 mt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Workflow module key</label>
                          <Select
                            value={actions[selectedNode.index]?.config?.moduleKey || 'leave'}
                            onChange={(val) => updateActionConfig(selectedNode.index, 'moduleKey', val)}
                            className="w-full custom-dark-select"
                          >
                            <Option value="leave">Leave Request Module</Option>
                            <Option value="recruitment">Recruitment / Offer Letters</Option>
                            <Option value="onboarding">Dynamic Onboarding</Option>
                          </Select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Entity Collection Type</label>
                          <Select
                            value={actions[selectedNode.index]?.config?.entityType || 'LeaveRequest'}
                            onChange={(val) => updateActionConfig(selectedNode.index, 'entityType', val)}
                            className="w-full custom-dark-select"
                          >
                            <Option value="LeaveRequest">LeaveRequest Document</Option>
                            <Option value="GeneratedLetter">GeneratedLetter Document</Option>
                            <Option value="OnboardingInstance">OnboardingInstance Document</Option>
                          </Select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Generated workflow name</label>
                          <Input
                            value={actions[selectedNode.index]?.config?.workflowName || ''}
                            onChange={(e) => updateActionConfig(selectedNode.index, 'workflowName', e.target.value)}
                            placeholder="e.g. Leave Approval Automation"
                            className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-sm"
                          />
                        </div>

                        <div className="border-t border-slate-700/50 pt-3">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Approval phases</label>
                            <button
                              type="button"
                              onClick={() => addApprovalStep(selectedNode.index)}
                              className="text-xs text-indigo-300 hover:text-indigo-200 transition flex items-center gap-1 font-semibold"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Phase
                            </button>
                          </div>

                          <div className="flex flex-col gap-3">
                            {getApprovalSteps(selectedNode.index).map((step, stepIndex) => (
                              <div key={`${step.key}-${stepIndex}`} className="bg-slate-900/40 border border-slate-700/80 p-3 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold text-indigo-300">Phase {stepIndex + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeApprovalStep(selectedNode.index, stepIndex)}
                                    className="text-slate-500 hover:text-red-400 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="flex flex-col gap-2">
                                  <Input
                                    size="small"
                                    value={step.name}
                                    onChange={(e) => updateApprovalStep(selectedNode.index, stepIndex, 'name', e.target.value)}
                                    placeholder="Phase name"
                                    className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-xs"
                                  />

                                  <Select
                                    size="small"
                                    value={step.approverType || 'REPORTING_MANAGER'}
                                    onChange={(val) => {
                                      updateApprovalStep(selectedNode.index, stepIndex, 'approverType', val);
                                      updateApprovalStep(selectedNode.index, stepIndex, 'approverValue', val === 'ROLE' ? '' : val);
                                    }}
                                    className="w-full custom-dark-select text-xs"
                                  >
                                    {APPROVER_OPTIONS.map((option) => (
                                      <Option key={option.value} value={option.value}>{option.label}</Option>
                                    ))}
                                  </Select>

                                  {step.approverType === 'ROLE' && (
                                    <Input
                                      size="small"
                                      value={step.approverValue}
                                      onChange={(e) => updateApprovalStep(selectedNode.index, stepIndex, 'approverValue', e.target.value)}
                                      placeholder="Role key, e.g. finance_head"
                                      className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-xs"
                                    />
                                  )}

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9px] font-bold text-slate-500 block mb-1">SLA HOURS</label>
                                      <InputNumber
                                        min={1}
                                        max={720}
                                        size="small"
                                        value={step.slaHours || 24}
                                        onChange={(val) => updateApprovalStep(selectedNode.index, stepIndex, 'slaHours', val || 24)}
                                        className="w-full bg-slate-800 border-slate-700 text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-bold text-slate-500 block mb-1">MODE</label>
                                      <Select
                                        size="small"
                                        value={step.approvalMode || 'ANY'}
                                        onChange={(val) => updateApprovalStep(selectedNode.index, stepIndex, 'approvalMode', val)}
                                        className="w-full custom-dark-select text-xs"
                                      >
                                        <Option value="ANY">Any</Option>
                                        <Option value="ALL">All</Option>
                                        <Option value="MAJORITY">Majority</Option>
                                      </Select>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[9px] font-bold text-slate-500 block mb-1">PHASE EMAIL TEMPLATE</label>
                                    <Select
                                      allowClear
                                      size="small"
                                      value={step.emailTriggerType || undefined}
                                      onChange={(val) => updateApprovalStep(selectedNode.index, stepIndex, 'emailTriggerType', val || '')}
                                      className="w-full custom-dark-select text-xs"
                                      placeholder="Send email when this phase opens"
                                    >
                                      {emailTemplates.map(t => (
                                        <Option key={t._id} value={t.triggerType}>{t.name} ({t.triggerType})</Option>
                                      ))}
                                    </Select>
                                  </div>

                                  <Input
                                    size="small"
                                    value={step.emailToField || 'assignee.email'}
                                    onChange={(e) => updateApprovalStep(selectedNode.index, stepIndex, 'emailToField', e.target.value)}
                                    placeholder="Email recipient path"
                                    className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-xs"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Requester field mapping</label>
                          <Input
                            value={actions[selectedNode.index]?.config?.requesterEmployeeField || 'employeeId'}
                            onChange={(e) => updateActionConfig(selectedNode.index, 'requesterEmployeeField', e.target.value)}
                            placeholder="e.g. employeeId"
                            className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-sm"
                          />
                        </div>

                        <div className="bg-indigo-950/40 border border-indigo-500/20 p-3.5 rounded-xl mt-2 leading-relaxed text-indigo-300 text-xs">
                          <strong className="text-white block mb-0.5">Hierarchy Node Routing:</strong>
                          Resolves reporting managers, branch heads, and designated role aliases dynamically based on active organization structures.
                        </div>
                      </div>
                    )}

                    {/* Action config: Webhook */}
                    {actions[selectedNode.index]?.type === 'WEBHOOK' && (
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Target URL Endpoint</label>
                          <Input
                            value={actions[selectedNode.index]?.config?.url}
                            onChange={(e) => updateActionConfig(selectedNode.index, 'url', e.target.value)}
                            placeholder="https://api.yourdomain.com/webhook"
                            className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">JSON payload mapping</label>
                          <Input.TextArea
                            rows={4}
                            value={actions[selectedNode.index]?.config?.payloadJson || '{}'}
                            onChange={(e) => updateActionConfig(selectedNode.index, 'payloadJson', e.target.value)}
                            placeholder='{ "event": "leave_applied", "days": "{{daysCount}}" }'
                            className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action config: Assign Task */}
                    {actions[selectedNode.index]?.type === 'ASSIGN_TASK' && (
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Task Title</label>
                          <Input
                            value={actions[selectedNode.index]?.config?.taskName}
                            onChange={(e) => updateActionConfig(selectedNode.index, 'taskName', e.target.value)}
                            placeholder="Assign onboarding document review"
                            className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Assignee field mapping</label>
                          <Input
                            value={actions[selectedNode.index]?.config?.assigneeField}
                            onChange={(e) => updateActionConfig(selectedNode.index, 'assigneeField', e.target.value)}
                            placeholder="Reporting Manager or CEO"
                            className="bg-slate-800 border-slate-700 text-white placeholder-slate-600 text-sm"
                          />
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Clear Selected Node button */}
                {selectedNode && (
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="mt-6 text-slate-500 hover:text-slate-350 text-xs border border-slate-700 hover:border-slate-600 p-2 rounded-lg transition"
                  >
                    Deselect Node
                  </button>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
