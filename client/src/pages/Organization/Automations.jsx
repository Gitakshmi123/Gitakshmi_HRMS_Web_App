import React, { useState, useEffect } from 'react';
import {
  Alert,
  Card,
  Table,
  Button,
  Switch,
  Space,
  message,
  Input,
  InputNumber,
  Select,
  Badge,
  AutoComplete,
  Tabs,
  Collapse,
  Radio,
  Tooltip,
  Progress,
  Drawer,
  Modal,
  List,
  Tag,
  Dropdown,
  Checkbox
} from 'antd';
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
  Info,
  Undo2,
  Redo2,
  Search,
  FileText,
  Clock,
  Link2,
  PlayCircle,
  Layers,
  Eye,
  Activity,
  Database,
  Copy,
  User,
  TrendingUp,
  BarChart3,
  MoreVertical,
  AlertTriangle,
  Send,
  Smartphone,
  Monitor,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  X,
  FileSpreadsheet
} from 'lucide-react';
import api from '../../utils/api';

const { Option } = Select;
const { Panel } = Collapse;

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
    reminderHours: 12,
    escalationContact: 'HR Head',
    emailTriggerType: '',
    emailToField: 'assignee.email'
  }
]);

const defaultActionConfig = (type) => ({
  SEND_EMAIL: { triggerType: '', toEmailField: 'employee.email', subject: 'Action Required', body: 'Dear employee...', recipients: ['EMPLOYEE'] },
  TRIGGER_APPROVAL: {
    moduleKey: 'leave',
    entityType: 'LeaveRequest',
    requesterEmployeeField: 'employeeId',
    workflowName: 'Leave Approval Automation',
    approvalSteps: defaultApprovalSteps(),
    approvalType: 'SEQUENTIAL', // SEQUENTIAL, PARALLEL, ANY_ONE, PERCENTAGE
    requiredPercentage: 100
  },
  WEBHOOK: { url: '', payloadJson: '{}' },
  ASSIGN_TASK: { taskName: '', description: '', assigneeField: 'employeeId' }
}[type] || {});

// Fields available dynamically per module selection
const MODULE_FIELDS = {
  leave: [
    { value: 'leaveType', label: 'Leave Type' },
    { value: 'daysCount', label: 'Leave Duration' },
    { value: 'leaveBalance', label: 'Leave Balance' },
    { value: 'reason', label: 'Reason' },
    { value: 'department', label: 'Department' },
    { value: 'location', label: 'Location' }
  ],
  recruitment: [
    { value: 'candidateName', label: 'Candidate Name' },
    { value: 'ctc', label: 'Offer CTC' },
    { value: 'department', label: 'Department' },
    { value: 'designation', label: 'Designation' },
    { value: 'joiningDate', label: 'Joining Date' }
  ],
  attendance: [
    { value: 'employeeName', label: 'Employee Name' },
    { value: 'shiftType', label: 'Shift' },
    { value: 'lateMinutes', label: 'Late Minutes' },
    { value: 'status', label: 'Status' },
    { value: 'date', label: 'Date' }
  ],
  employee: [
    { value: 'name', label: 'Employee Name' },
    { value: 'role', label: 'Role' },
    { value: 'dateOfJoining', label: 'Date of Joining' },
    { value: 'probationPeriod', label: 'Probation Period' }
  ]
};

const MODULE_TRIGGERS = {
  leave: [
    { value: 'LEAVE_REQUESTED', label: 'Leave Requested', desc: 'Employee submits leave request' },
    { value: 'LEAVE_APPROVED', label: 'Leave Approved', desc: 'Leave request gets approved' },
    { value: 'LEAVE_REJECTED', label: 'Leave Rejected', desc: 'Leave request gets rejected' },
    { value: 'LEAVE_CANCELLED', label: 'Leave Cancelled', desc: 'Leave request gets cancelled' },
    { value: 'LEAVE_WITHDRAWN', label: 'Leave Withdrawn', desc: 'Leave request is withdrawn' },
    { value: 'LEAVE_EXTENDED', label: 'Leave Extended', desc: 'Leave request is extended' },
    { value: 'LEAVE_BALANCE_LOW', label: 'Leave Balance Low', desc: 'Leave balance falls below threshold' }
  ],
  recruitment: [
    { value: 'CANDIDATE_APPLIED', label: 'Candidate Applied', desc: 'New candidate application received' },
    { value: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled', desc: 'Interview round is scheduled' },
    { value: 'INTERVIEW_COMPLETED', label: 'Interview Completed', desc: 'Interview round is feedback-submitted' },
    { value: 'OFFER_LETTER_REQUESTED', label: 'Offer Generated', desc: 'Offer letter creation requested' },
    { value: 'OFFER_APPROVED', label: 'Offer Approved', desc: 'Offer letter approved by management' },
    { value: 'OFFER_ACCEPTED', label: 'Offer Accepted', desc: 'Offer accepted by candidate' },
    { value: 'JOINING_COMPLETED', label: 'Joining Completed', desc: 'Candidate completed onboarding joining documentation' }
  ],
  attendance: [
    { value: 'LATE_COMING', label: 'Late Coming', desc: 'Employee checks in late' },
    { value: 'ABSENT', label: 'Absent Alert', desc: 'Employee is absent without notification' },
    { value: 'EARLY_EXIT', label: 'Early Exit', desc: 'Employee check out before shifts end' },
    { value: 'OVERTIME', label: 'Overtime Triggered', desc: 'Employee completes overtime duration' },
    { value: 'REGULARIZATION_REQUEST', label: 'Regularization Request', desc: 'Attendance correction requested' }
  ],
  employee: [
    { value: 'EMPLOYEE_CREATED', label: 'Employee Created', desc: 'New employee record created' },
    { value: 'EMPLOYEE_JOINED', label: 'Employee Joined', desc: 'New employee joins the organization' },
    { value: 'PROBATION_END', label: 'Probation End', desc: 'Employee probation period completes' },
    { value: 'CONFIRMATION_DUE', label: 'Confirmation Due', desc: 'Employee confirmation review due' },
    { value: 'PROMOTION', label: 'Promotion', desc: 'Employee grade or designation promoted' },
    { value: 'TRANSFER', label: 'Transfer', desc: 'Employee location or department transferred' },
    { value: 'RESIGNATION', label: 'Resignation Submitted', desc: 'Employee submits resignation letter' },
    { value: 'EXIT', label: 'Exit Clearance', desc: 'Employee exit process initiated' }
  ],
  custom: [
    { value: 'CUSTOM_EVENT', label: 'Custom Event', desc: 'Trigger workflow via custom API event' }
  ]
};

export default function Automations() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Tab state: 'list' (Visual Workflows List), 'dashboard' (Analytics Dashboard), 'executions' (Execution Logs)
  const [currentTab, setCurrentTab] = useState('list');

  // Visual Builder States
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderId, setBuilderId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [triggerEvent, setTriggerEvent] = useState('LEAVE_REQUESTED');
  const [conditions, setConditions] = useState([]);
  const [actions, setActions] = useState([]);

  // Module selection for triggers and variable fields
  const [selectedModule, setSelectedModule] = useState('leave');

  // Selected Node for parameters inspector
  const [selectedNode, setSelectedNode] = useState(null); // { type: 'trigger' | 'condition' | 'action', index?: number }
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Left sidebar node search
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Zoom & Undo/Redo States
  const [zoom, setZoom] = useState(1.0);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoingOrRedoing, setIsUndoingOrRedoing] = useState(false);

  // Snap grid & Mini map toggles
  const [snapGrid, setSnapGrid] = useState(true);
  const [miniMap, setMiniMap] = useState(true);

  // Email Preview state
  const [emailPreviewMode, setEmailPreviewMode] = useState('desktop');

  // Simulation Engine states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simParams, setSimParams] = useState({
    leaveType: 'Casual Leave',
    daysCount: 7,
    leaveBalance: 12,
    department: 'IT',
    location: 'Ahmedabad'
  });
  const [simResults, setSimResults] = useState([]);
  const [simRunning, setSimRunning] = useState(false);

  // Notification center alerts (Simulated Failures)
  const [alerts, setAlerts] = useState([
    { id: 1, text: 'Email sending failed: Host smtp.gmail.com unreachable.', time: '10 mins ago', type: 'error', workflow: 'Leave Approval Process' },
    { id: 2, text: 'Webhook response: 504 Gateway Timeout on SAP sync endpoint.', time: '2 hours ago', type: 'warning', workflow: 'Offer Approval Flow' }
  ]);
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);

  // Deriving selected module whenever triggerEvent changes
  useEffect(() => {
    let foundModule = 'leave';
    Object.keys(MODULE_TRIGGERS).forEach((mod) => {
      const matched = MODULE_TRIGGERS[mod].find((t) => t.value === triggerEvent);
      if (matched) {
        foundModule = mod;
      }
    });
    setSelectedModule(foundModule);
  }, [triggerEvent]);

  // Automatic history tracking useEffect
  useEffect(() => {
    if (!isBuilderOpen) return;
    if (isUndoingOrRedoing) {
      setIsUndoingOrRedoing(false);
      return;
    }

    const state = {
      triggerEvent,
      conditions: JSON.parse(JSON.stringify(conditions)),
      actions: JSON.parse(JSON.stringify(actions))
    };

    if (historyIndex >= 0) {
      const current = history[historyIndex];
      const isEqual = current.triggerEvent === triggerEvent &&
        JSON.stringify(current.conditions) === JSON.stringify(conditions) &&
        JSON.stringify(current.actions) === JSON.stringify(actions);
      if (isEqual) return;
    }

    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, state]);
    setHistoryIndex(nextHistory.length);
  }, [triggerEvent, conditions, actions, isBuilderOpen]);

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const state = history[prevIndex];
      setIsUndoingOrRedoing(true);
      setTriggerEvent(state.triggerEvent);
      setIsUndoingOrRedoing(true);
      setConditions(state.conditions);
      setIsUndoingOrRedoing(true);
      setActions(state.actions);
      setHistoryIndex(prevIndex);
      message.info('Undo applied');
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const state = history[nextIndex];
      setIsUndoingOrRedoing(true);
      setTriggerEvent(state.triggerEvent);
      setIsUndoingOrRedoing(true);
      setConditions(state.conditions);
      setIsUndoingOrRedoing(true);
      setActions(state.actions);
      setHistoryIndex(nextIndex);
      message.info('Redo applied');
    }
  };

  const handleLoadTemplate = (templateType) => {
    let tTrigger = 'LEAVE_REQUESTED';
    let tConditions = [];
    let tActions = [];

    if (templateType === 'RM_APPROVAL') {
      tTrigger = 'LEAVE_REQUESTED';
      tConditions = [];
      tActions = [
        {
          type: 'TRIGGER_APPROVAL',
          config: {
            moduleKey: 'leave',
            entityType: 'LeaveRequest',
            requesterEmployeeField: 'employeeId',
            workflowName: 'Manager Leave Approval',
            approvalSteps: [
              {
                key: 'reporting_manager_approval',
                name: 'Reporting Manager Approval',
                approverType: 'REPORTING_MANAGER',
                approverValue: 'REPORTING_MANAGER',
                approvalMode: 'ANY',
                minApprovals: 1,
                slaHours: 24,
                reminderHours: 12,
                escalationContact: 'HR Head',
                emailTriggerType: '',
                emailToField: 'assignee.email'
              }
            ]
          },
          order: 1
        }
      ];
      setName('Manager Leave Approval Flow');
      setDescription('Standard leave approval route to Reporting Manager.');
    } else if (templateType === 'AUTO_EMAIL') {
      tTrigger = 'LEAVE_REQUESTED';
      tConditions = [
        { field: 'daysCount', operator: 'less_than', value: '3' }
      ];
      tActions = [
        {
          type: 'SEND_EMAIL',
          config: {
            triggerType: '',
            toEmailField: 'employee.email',
            subject: 'Short Leave Notification Received',
            body: 'Dear {{employee_name}}, your short leave for {{leave_days}} days has been logged.',
            recipients: ['EMPLOYEE', 'MANAGER']
          },
          order: 1
        }
      ];
      setName('Short Leave Auto-Notify');
      setDescription('Automatically notify employees for leave request under 3 days.');
    } else if (templateType === 'OFFER_RELEASE') {
      tTrigger = 'OFFER_LETTER_REQUESTED';
      tConditions = [];
      tActions = [
        {
          type: 'TRIGGER_APPROVAL',
          config: {
            moduleKey: 'recruitment',
            entityType: 'GeneratedLetter',
            requesterEmployeeField: 'employeeId',
            workflowName: 'Offer Letter Approval',
            approvalType: 'SEQUENTIAL',
            approvalSteps: [
              {
                key: 'hr_head_approval',
                name: 'HR Head Approval',
                approverType: 'HR_HEAD',
                approverValue: 'HR_HEAD',
                approvalMode: 'ANY',
                minApprovals: 1,
                slaHours: 24,
                reminderHours: 12,
                escalationContact: 'CEO',
                emailTriggerType: '',
                emailToField: 'assignee.email'
              },
              {
                key: 'ceo_approval',
                name: 'CEO Final Approval',
                approverType: 'CEO',
                approverValue: 'CEO',
                approvalMode: 'ANY',
                minApprovals: 1,
                slaHours: 48,
                reminderHours: 24,
                escalationContact: 'HR Head',
                emailTriggerType: '',
                emailToField: 'assignee.email'
              }
            ]
          },
          order: 1
        },
        {
          type: 'SEND_EMAIL',
          config: {
            triggerType: '',
            toEmailField: 'employee.email',
            subject: 'Congratulations! Offer Letter Approved',
            body: 'Dear candidate, your offer ctc is {{offer_ctc}}.',
            recipients: ['EMPLOYEE']
          },
          order: 2
        }
      ];
      setName('Offer Release Approval');
      setDescription('Workflow for HR Head & CEO approval and automated release of offer letters.');
    }

    setTriggerEvent(tTrigger);
    setConditions(tConditions);
    setActions(tActions);
    setSelectedNode({ type: 'trigger' });
    message.success('Template loaded successfully. You can edit before saving.');
  };

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
    let initialTrigger = 'LEAVE_REQUESTED';
    let initialConditions = [];
    let initialActions = [
      {
        type: 'TRIGGER_APPROVAL',
        config: defaultActionConfig('TRIGGER_APPROVAL'),
        order: 1
      }
    ];

    if (record) {
      setBuilderId(record._id);
      setName(record.name || '');
      setDescription(record.description || '');
      setIsActive(record.isActive !== false);
      initialTrigger = record.triggerEvent || 'LEAVE_REQUESTED';
      initialConditions = record.conditions?.length ? record.conditions : [];
      initialActions = record.actions?.length ? record.actions.sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
    } else {
      setBuilderId(null);
      setName('');
      setDescription('');
      setIsActive(true);
    }

    setTriggerEvent(initialTrigger);
    setConditions(initialConditions);
    setActions(initialActions);
    setSelectedNode({ type: 'trigger' });
    setZoom(1.0);

    // Initialize history
    const initialState = {
      triggerEvent: initialTrigger,
      conditions: JSON.parse(JSON.stringify(initialConditions)),
      actions: JSON.parse(JSON.stringify(initialActions))
    };
    setHistory([initialState]);
    setHistoryIndex(0);
    setIsBuilderOpen(true);
  };

  const closeVisualBuilder = () => {
    setIsBuilderOpen(false);
    setBuilderId(null);
    setSelectedNode(null);
    setHistory([]);
    setHistoryIndex(-1);
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
        actionsCount: actions.length,
        zoom,
        snapGrid
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
    if (e) e.stopPropagation();
    const updated = actions.filter((_, i) => i !== index).map((act, i) => ({ ...act, order: i + 1 }));
    setActions(updated);
    if (selectedNode?.type === 'action' && selectedNode.index === index) {
      setSelectedNode({ type: 'trigger' });
    } else if (selectedNode?.type === 'action' && selectedNode.index > index) {
      setSelectedNode({ type: 'action', index: selectedNode.index - 1 });
    }
  };

  const duplicateAction = (index, e) => {
    if (e) e.stopPropagation();
    const original = actions[index];
    const duplicated = {
      type: original.type,
      config: JSON.parse(JSON.stringify(original.config)),
      order: actions.length + 1
    };
    const newActions = [...actions, duplicated];
    setActions(newActions);
    setSelectedNode({ type: 'action', index: newActions.length - 1 });
    message.success('Node duplicated');
  };

  const moveAction = (index, direction, e) => {
    if (e) e.stopPropagation();
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
    setConditions([...conditions, { field: MODULE_FIELDS[selectedModule]?.[0]?.value || 'daysCount', operator: 'equals', value: '' }]);
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
          reminderHours: 12,
          escalationContact: 'HR Head',
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

  const runSimulation = () => {
    setSimRunning(true);
    setSimResults([]);
    setTimeout(() => {
      const trace = [];
      trace.push({ name: `Trigger: ${MODULE_TRIGGERS[selectedModule]?.find(t => t.value === triggerEvent)?.label || triggerEvent}`, status: 'success', desc: `Captured source event payload. Context module initialized as: ${selectedModule.toUpperCase()}` });
      
      let conditionCheck = true;
      if (conditions.length > 0) {
        const condPassed = conditions.map(c => {
          const actualVal = simParams[c.field];
          let passed = false;
          if (c.operator === 'equals') passed = String(actualVal) === String(c.value);
          else if (c.operator === 'not_equals') passed = String(actualVal) !== String(c.value);
          else if (c.operator === 'contains') passed = String(actualVal).includes(c.value);
          else if (c.operator === 'greater_than') passed = Number(actualVal) > Number(c.value);
          else if (c.operator === 'less_than') passed = Number(actualVal) < Number(c.value);
          return { ...c, passed };
        });
        conditionCheck = condPassed.every(c => c.passed);
        trace.push({ 
          name: 'Condition Gate Evaluation', 
          status: conditionCheck ? 'success' : 'failed', 
          desc: conditionCheck 
            ? `All rules passed validation: ${conditions.map(c => `${c.field} (${simParams[c.field]}) ${c.operator} ${c.value}`).join(' AND ')}`
            : `Rules validation failed: Not all conditions met.` 
        });
      } else {
        trace.push({ name: 'Condition Gate Evaluation', status: 'success', desc: 'No conditions set. Automatic routing applied.' });
      }

      if (conditionCheck) {
        actions.forEach((act, idx) => {
          if (act.type === 'TRIGGER_APPROVAL') {
            const steps = act.config.approvalSteps || defaultApprovalSteps();
            steps.forEach((step, sIdx) => {
              trace.push({
                name: `Action ${idx + 1}: ${act.config.workflowName || 'Approval Step'} - Phase ${sIdx + 1} (${step.name})`,
                status: 'pending',
                desc: `Routed to ${APPROVER_OPTIONS.find(o => o.value === step.approverType)?.label || step.approverType} (${step.approverValue}). SLA setting: ${step.slaHours} hours. Reminders: ${step.reminderHours} hours. Escalation destination: ${step.escalationContact}.`
              });
            });
          } else if (act.type === 'SEND_EMAIL') {
            trace.push({
              name: `Action ${idx + 1}: Send Email Notification`,
              status: 'success',
              desc: `Notification dispatched successfully to target employee field (${act.config.toEmailField}) with subject "${act.config.subject || 'Notification'}".`
            });
          } else if (act.type === 'WEBHOOK') {
            trace.push({
              name: `Action ${idx + 1}: Call Webhook Endpoint`,
              status: 'success',
              desc: `POST request processed to target url: ${act.config.url || 'No URL'}. Payload successfully resolved with variables.`
            });
          } else if (act.type === 'ASSIGN_TASK') {
            trace.push({
              name: `Action ${idx + 1}: Assign Activity Task`,
              status: 'success',
              desc: `Task titled "${act.config.taskName || 'Onboarding Activity'}" assigned to organization field: ${act.config.assigneeField}.`
            });
          }
        });
      }
      setSimResults(trace);
      setSimRunning(false);
    }, 1200);
  };

  const columns = [
    {
      title: 'Workflow Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <div>
            <div className="font-bold text-slate-800">{text}</div>
            {record.description && <div className="text-xs text-slate-400 mt-0.5">{record.description}</div>}
          </div>
        </div>
      )
    },
    {
      title: 'Module',
      key: 'module',
      render: (_, record) => {
        let mod = 'leave';
        Object.keys(MODULE_TRIGGERS).forEach((m) => {
          if (MODULE_TRIGGERS[m].some(t => t.value === record.triggerEvent)) {
            mod = m;
          }
        });
        const colors = {
          leave: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          recruitment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          attendance: 'bg-amber-50 text-amber-700 border-amber-200',
          employee: 'bg-violet-50 text-violet-700 border-violet-200',
          custom: 'bg-slate-50 text-slate-700 border-slate-200'
        }[mod] || 'bg-slate-50 text-slate-700';

        return (
          <span className={`text-[10px] px-2 py-0.5 border rounded-full font-bold uppercase tracking-wider ${colors}`}>
            {mod}
          </span>
        );
      }
    },
    {
      title: 'Trigger Event',
      dataIndex: 'triggerEvent',
      key: 'triggerEvent',
      render: (val) => {
        const text = {
          LEAVE_REQUESTED: 'Leave Requested',
          LEAVE_APPROVED: 'Leave Approved',
          LEAVE_REJECTED: 'Leave Rejected',
          EMPLOYEE_JOINED: 'Employee Joined',
          OFFER_LETTER_REQUESTED: 'Offer Letter Requested',
          TICKET_CREATED: 'Ticket Created'
        }[val] || val;

        return (
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-slate-600 font-medium">{text}</span>
          </div>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val, record) => (
        <div className="flex items-center gap-2">
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
          <Badge status={val ? 'success' : 'default'} text={val ? 'Active' : 'Inactive'} className="text-xs text-slate-500 font-medium" />
        </div>
      )
    },
    {
      title: 'Conditions Count',
      key: 'conditions',
      render: (_, record) => (
        <span className="text-xs font-semibold text-slate-600">
          {record.conditions?.length ? `${record.conditions.length} filters` : 'Apply to All'}
        </span>
      )
    },
    {
      title: 'Action Flow Steps',
      key: 'actions',
      render: (_, record) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(record.actions || []).sort((a, b) => a.order - b.order).map((act, i) => {
            const label = {
              SEND_EMAIL: 'Email',
              TRIGGER_APPROVAL: 'Approval',
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
              <span key={i} className={`text-[10px] px-1.5 py-0.5 border rounded font-semibold ${color}`}>
                {label}
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
          <Button type="primary" size="small" ghost onClick={() => openVisualBuilder(record)} className="hover:bg-indigo-50 hover:border-indigo-300">
            Edit Flow
          </Button>
          <Button danger type="primary" size="small" ghost onClick={() => handleDelete(record._id)}>
            Delete
          </Button>
        </Space>
      )
    }
  ];

  // Sidebar search filter logic
  const filteredSidebarNodeList = (category) => {
    const nodes = {
      triggers: [
        { type: 'LEAVE', label: 'Leave', desc: 'Trigger leaves logic', module: 'leave' },
        { type: 'ATTENDANCE', label: 'Attendance', desc: 'Shift & regularization events', module: 'attendance' },
        { type: 'RECRUITMENT', label: 'Recruitment', desc: 'Offer & interview triggers', module: 'recruitment' },
        { type: 'EMPLOYEE', label: 'Employee', desc: 'Lifecycle transition triggers', module: 'employee' }
      ],
      approvals: [
        { type: 'SINGLE', label: 'Single Approval', desc: 'Single step decision' },
        { type: 'MULTI', label: 'Multi Level Approval', desc: 'Multiple consecutive approvals' },
        { type: 'PARALLEL', label: 'Parallel Approval', desc: 'All approvers must complete' },
        { type: 'ROLE', label: 'Role Approval', desc: 'Sent to dynamic alias role' }
      ],
      conditions: [
        { type: 'IF_ELSE', label: 'If Else Gate', desc: 'Split path evaluation rules' },
        { type: 'SWITCH', label: 'Switch Split', desc: 'Multiple route splits' }
      ],
      communication: [
        { type: 'SEND_EMAIL', label: 'Send Email', desc: 'Rich SMTP template alert' },
        { type: 'SMS', label: 'SMS Notification', desc: 'Short cellular text message' },
        { type: 'WHATSAPP', label: 'WhatsApp Message', desc: 'Instant WhatsApp template API' },
        { type: 'IN_APP', label: 'In-App Alert', desc: 'Dashboard notifications banner' }
      ],
      documents: [
        { type: 'PDF', label: 'Generate PDF', desc: 'Create generic PDF content' },
        { type: 'OFFER_LETTER', label: 'Generate Offer Letter', desc: 'Compile candidates details' },
        { type: 'CONTRACT', label: 'Generate Contract', desc: 'Create employee contracts' }
      ],
      integrations: [
        { type: 'WEBHOOK', label: 'Call Webhook', desc: 'Trigger webhook API callback' },
        { type: 'REST_API', label: 'REST API Request', desc: 'Standard POST/GET JSON link' },
        { type: 'SAP_SYNC', label: 'SAP ERP Integration', desc: 'Export datasets to SAP module' }
      ],
      utilities: [
        { type: 'DELAY', label: 'Delay Timer', desc: 'Wait duration before continuing' },
        { type: 'WAIT', label: 'Wait for Condition', desc: 'Hold until trigger evaluates true' }
      ]
    }[category] || [];

    return nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
        n.desc.toLowerCase().includes(sidebarSearch.toLowerCase())
    );
  };

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
            {/* Enterprise Portal Title */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <Layers className="w-6 h-6 text-indigo-600" />
                  Business Process Automation Engine
                </h1>
                <p className="text-slate-400 text-sm mt-0.5">
                  Visual flowchart designer, approval matrix managers, and conditions filters.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Alerts Notification center bell */}
                <Badge count={alerts.length} size="small" offset={[-2, 2]} className="cursor-pointer">
                  <Button
                    icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                    onClick={() => setIsAlertDrawerOpen(true)}
                    className="flex items-center justify-center border-slate-200"
                  >
                    Alerts Center
                  </Button>
                </Badge>

                <Button
                  type="primary"
                  className="bg-indigo-600 hover:bg-indigo-700 border-none h-10 px-6 rounded-lg font-medium shadow-sm flex items-center gap-1.5"
                  onClick={() => openVisualBuilder()}
                >
                  <Plus className="w-4.5 h-4.5" /> Create Workflow
                </Button>
              </div>
            </div>

            {/* Custom Tab system for Workflows, Dashboard, and Execution Log Trace */}
            <div className="mb-6 border-b border-slate-200">
              <div className="flex gap-6">
                <button
                  onClick={() => setCurrentTab('list')}
                  className={`pb-3 font-semibold text-sm transition-all relative ${
                    currentTab === 'list' ? 'text-indigo-600' : 'text-slate-450 hover:text-slate-605'
                  }`}
                >
                  Visual Workflows
                  {currentTab === 'list' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                  )}
                </button>

                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className={`pb-3 font-semibold text-sm transition-all relative ${
                    currentTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-450 hover:text-slate-605'
                  }`}
                >
                  Analytics Dashboard
                  {currentTab === 'dashboard' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                  )}
                </button>

                <button
                  onClick={() => setCurrentTab('executions')}
                  className={`pb-3 font-semibold text-sm transition-all relative ${
                    currentTab === 'executions' ? 'text-indigo-600' : 'text-slate-450 hover:text-slate-605'
                  }`}
                >
                  Execution Logs
                  {currentTab === 'executions' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                  )}
                </button>
              </div>
            </div>

            {/* TAB CONTENT: Workflows List */}
            {currentTab === 'list' && (
              <>
                <Alert
                  message={
                    <span className="font-semibold text-indigo-850 flex items-center gap-1.5">
                      <Info className="w-5 h-5 text-indigo-600" /> System Manual: Dynamic Module-Specific Operations
                    </span>
                  }
                  description={
                    <div className="mt-1 text-xs text-slate-550 leading-relaxed">
                      This engine adapts automatically dynamically to selected business modules. Selecting a module like{' '}
                      <strong className="text-indigo-600">Leave</strong> or{' '}
                      <strong className="text-indigo-600">Recruitment</strong> will transform templates, form properties mapping, conditions criteria logic, and approvers matrices dynamically.
                    </div>
                  }
                  type="info"
                  className="mb-6 border-indigo-100 bg-indigo-50/40 rounded-xl"
                />

                <Card className="rounded-xl border-slate-100 shadow-sm overflow-hidden p-0">
                  <Table
                    dataSource={automations}
                    columns={columns}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    className="custom-table"
                  />
                </Card>
              </>
            )}

            {/* TAB CONTENT: Analytics Dashboard */}
            {currentTab === 'dashboard' && (
              <div className="flex flex-col gap-6">
                {/* Stats cards row */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card className="border-slate-150 rounded-xl shadow-xs">
                    <div className="text-xs text-slate-450 font-bold uppercase tracking-wider">Total Workflows</div>
                    <div className="text-3xl font-black text-slate-800 mt-2">122</div>
                    <div className="text-[10px] text-indigo-600 mt-1 font-semibold">18 Active, 7 Drafts</div>
                  </Card>
                  <Card className="border-slate-150 rounded-xl shadow-xs">
                    <div className="text-xs text-slate-450 font-bold uppercase tracking-wider">Active Platforms</div>
                    <div className="text-3xl font-black text-indigo-600 mt-2">18</div>
                    <div className="text-[10px] text-emerald-650 mt-1 font-semibold">Running 100% Ok</div>
                  </Card>
                  <Card className="border-slate-150 rounded-xl shadow-xs">
                    <div className="text-xs text-slate-450 font-bold uppercase tracking-wider">Draft Runs</div>
                    <div className="text-3xl font-black text-amber-600 mt-2">7</div>
                    <div className="text-[10px] text-slate-450 mt-1 font-semibold">Ready for deployment</div>
                  </Card>
                  <Card className="border-slate-150 rounded-xl shadow-xs">
                    <div className="text-xs text-slate-450 font-bold uppercase tracking-wider">Failed Executions</div>
                    <div className="text-3xl font-black text-rose-600 mt-2">3</div>
                    <div className="text-[10px] text-rose-500 mt-1 font-semibold">Needs retry attention</div>
                  </Card>
                  <Card className="border-slate-150 rounded-xl shadow-xs">
                    <div className="text-xs text-slate-450 font-bold uppercase tracking-wider">Pending Approvals</div>
                    <div className="text-3xl font-black text-violet-600 mt-2">41</div>
                    <div className="text-[10px] text-slate-400 mt-1">Average wait: 4.6 Hours</div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Average response times */}
                  <Card title={<span className="font-bold text-sm text-slate-700 flex items-center gap-1.5"><Clock className="w-4 h-4 text-indigo-500" /> Average Approval Duration</span>} className="border-slate-150 rounded-xl">
                    <div className="flex flex-col gap-5 py-2">
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-650 mb-1">
                          <span>Reporting Manager</span>
                          <span>4 Hours</span>
                        </div>
                        <Progress percent={40} showInfo={false} strokeColor="#4f46e5" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-650 mb-1">
                          <span>Department Head</span>
                          <span>8 Hours</span>
                        </div>
                        <Progress percent={80} showInfo={false} strokeColor="#8b5cf6" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-650 mb-1">
                          <span>CEO / executive directors</span>
                          <span>2 Hours</span>
                        </div>
                        <Progress percent={20} showInfo={false} strokeColor="#f59e0b" />
                      </div>
                    </div>
                  </Card>

                  {/* Approval Matrix UI visualizer */}
                  <Card title={<span className="font-bold text-sm text-slate-700 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-500" /> Approval Resolution Hierarchy (SuccessFactors Model)</span>} className="border-slate-150 rounded-xl">
                    <div className="flex flex-col items-center justify-center py-4 bg-slate-50/50 rounded-xl border border-slate-100">
                      <div className="flex flex-col gap-3 items-center w-full max-w-sm">
                        <div className="w-full bg-white border border-slate-200 px-4 py-2 rounded-lg text-center font-semibold text-xs text-slate-700 shadow-xs flex items-center justify-between">
                          <span>👤 Employee</span>
                          <span className="text-[10px] text-slate-400">Initiates Request</span>
                        </div>
                        <div className="w-0.5 h-4 bg-indigo-200" />
                        <div className="w-full bg-white border border-indigo-200 px-4 py-2 rounded-lg text-center font-semibold text-xs text-slate-800 shadow-xs flex items-center justify-between">
                          <span>👥 Reporting Manager</span>
                          <span className="text-[10px] text-indigo-500">First Approver</span>
                        </div>
                        <div className="w-0.5 h-4 bg-indigo-200" />
                        <div className="w-full bg-white border border-slate-200 px-4 py-2 rounded-lg text-center font-semibold text-xs text-slate-700 shadow-xs flex items-center justify-between">
                          <span>🏢 Department Head</span>
                          <span className="text-[10px] text-slate-400">Second Stage</span>
                        </div>
                        <div className="w-0.5 h-4 bg-indigo-200" />
                        <div className="w-full bg-white border border-slate-200 px-4 py-2 rounded-lg text-center font-semibold text-xs text-slate-700 shadow-xs flex items-center justify-between">
                          <span>👔 CEO / Director</span>
                          <span className="text-[10px] text-slate-400">Final Gate</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-450 mt-4 italic">Drag & drop to reorder elements inside visual builder action settings.</div>
                    </div>
                  </Card>
                </div>

                {/* Prebuilt Template Marketplace import presets */}
                <Card title={<span className="font-bold text-sm text-slate-700 flex items-center gap-1.5"><Layers className="w-4 h-4 text-violet-500" /> Visual Workflow Templates Marketplace</span>} className="border-slate-150 rounded-xl">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { type: 'RM_APPROVAL', name: 'Simple Leave Approval Flow', desc: 'Automate leave routing straight to the Reporting Manager.', tag: 'Leaves' },
                      { type: 'AUTO_EMAIL', name: 'Short Leave Notification Alert', desc: 'Send direct auto-email responses for requests under 3 days.', tag: 'Notifications' },
                      { type: 'OFFER_RELEASE', name: 'Offer Letter Releases workflow', desc: 'Secure approval workflow involving HR Head and CEO review.', tag: 'Recruitment' }
                    ].map((t) => (
                      <div key={t.type} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-400 transition hover:shadow-sm bg-white flex flex-col justify-between">
                        <div>
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[9px] rounded font-bold uppercase tracking-wider">{t.tag}</span>
                          <h4 className="font-bold text-slate-805 text-sm mt-2">{t.name}</h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{t.desc}</p>
                        </div>
                        <Button
                          type="primary"
                          ghost
                          size="small"
                          onClick={() => {
                            openVisualBuilder();
                            // Load it via delay once builder renders
                            setTimeout(() => handleLoadTemplate(t.type), 150);
                          }}
                          className="mt-4 w-full text-indigo-650 border-indigo-200 hover:bg-indigo-50"
                        >
                          One-Click Import
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* TAB CONTENT: Execution Logs */}
            {currentTab === 'executions' && (
              <Card className="rounded-xl border-slate-100 shadow-sm overflow-hidden p-0">
                <div className="p-4 border-b border-slate-100 font-bold text-slate-800 text-sm">Visual Execution Monitor</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="p-4">Run / ID</th>
                        <th className="p-4">Workflow Name</th>
                        <th className="p-4">Triggered At</th>
                        <th className="p-4">Dynamic Flow Steps Trace</th>
                        <th className="p-4">Current Owner</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { id: 'WF-1543', name: 'Leave Approval Process', time: '09:22 AM', trace: [{ l: 'Manager Approved', s: 'done' }, { l: 'Email Notification Sent', s: 'done' }, { l: 'HR Approval Pending', s: 'pending' }], owner: 'HR Manager', status: 'In Progress', statusType: 'processing' },
                        { id: 'WF-1542', name: 'Short Leave Auto-Notify', time: '08:15 AM', trace: [{ l: 'Leave Captured', s: 'done' }, { l: 'Condition Filter Passed', s: 'done' }, { l: 'Auto Notification Dispatched', s: 'done' }], owner: 'System Engine', status: 'Completed', statusType: 'success' },
                        { id: 'WF-1541', name: 'Offer Approval Flow', time: 'Yesterday', trace: [{ l: 'Offer Generated', s: 'done' }, { l: 'CEO Approval', s: 'done' }, { l: 'SAP ERP Sync Webhook', s: 'failed' }], owner: 'IT Administrator', status: 'Failed', statusType: 'error' }
                      ].map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-bold text-indigo-650">{log.id}</td>
                          <td className="p-4 font-semibold text-slate-700">{log.name}</td>
                          <td className="p-4 text-slate-400">{log.time}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {log.trace.map((t, idx) => (
                                <React.Fragment key={idx}>
                                  <span className={`px-2 py-0.5 border rounded font-semibold text-[10px] ${
                                    t.s === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                                    t.s === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-150' :
                                    'bg-indigo-50 text-indigo-700 border-indigo-150 animate-pulse'
                                  }`}>
                                    {t.s === 'done' && '✓ '}{t.s === 'failed' && '✗ '}{t.s === 'pending' && '⌛ '}{t.l}
                                  </span>
                                  {idx < log.trace.length - 1 && <span className="text-slate-300">→</span>}
                                </React.Fragment>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-slate-650 font-semibold">{log.owner}</td>
                          <td className="p-4">
                            <Tag color={log.statusType === 'success' ? 'success' : log.statusType === 'error' ? 'error' : 'processing'}>
                              {log.status}
                            </Tag>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </motion.div>
        ) : (
          /* FULLSCREEN VISUAL BUILDER WORKSPACE */
          <motion.div
            key="builder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col font-sans select-none"
          >
            {/* BUILDER HEADER */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-4">
                <button
                  onClick={closeVisualBuilder}
                  className="text-slate-450 hover:text-slate-805 transition p-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Workflow Name (e.g., Leave Approval Flow)"
                      className="bg-transparent border-none outline-none font-bold text-lg text-slate-808 placeholder-slate-400 w-80 focus:ring-0 focus:border-b focus:border-indigo-400 py-0"
                    />
                    <span className="text-[9px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold uppercase tracking-wider">
                      Draft
                    </span>
                    <span className="text-[9px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-bold">
                      v2.1
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-450">
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Short description of this automation..."
                      className="bg-transparent border-none outline-none text-xs text-slate-500 placeholder-slate-400 w-96 py-0 focus:ring-0"
                    />
                    <span>• Last modified: Today 11:20 AM</span>
                  </div>
                </div>
              </div>

              {/* Header actions: Undo, Redo, Templates, Active, Actions */}
              <div className="flex items-center gap-4">
                {/* Undo / Redo buttons */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                  <button
                    disabled={historyIndex <= 0}
                    onClick={undo}
                    className="p-1.5 hover:bg-slate-50 rounded text-slate-650 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center justify-center"
                    title="Undo Change"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-slate-250 mx-0.5" />
                  <button
                    disabled={historyIndex >= history.length - 1}
                    onClick={redo}
                    className="p-1.5 hover:bg-slate-50 rounded text-slate-655 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center justify-center"
                    title="Redo Change"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Loading presets templates */}
                <Select
                  placeholder="Load Template"
                  onChange={handleLoadTemplate}
                  className="w-44"
                  value={undefined}
                  dropdownMatchSelectWidth={false}
                  dropdownStyle={{ minWidth: 200 }}
                  options={[
                    { value: 'RM_APPROVAL', label: 'Simple RM Approval' },
                    { value: 'AUTO_EMAIL', label: 'Short Leave Auto Email' },
                    { value: 'OFFER_RELEASE', label: 'Offer Release Chain' }
                  ]}
                />

                <div className="w-px h-6 bg-slate-200 mx-1" />

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-450 tracking-wider">ACTIVE</span>
                  <Switch checked={isActive} onChange={setIsActive} className="bg-slate-600" />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSimResults([]);
                      setIsSimulating(true);
                    }}
                    className="border border-slate-200 hover:border-indigo-400 hover:text-indigo-650 bg-white font-semibold text-xs px-4 py-2 rounded-lg transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <PlayCircle className="w-4 h-4" /> Test Workflow
                  </button>

                  <button
                    onClick={handleSaveWorkflow}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2 rounded-lg transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Save Workflow
                  </button>
                </div>
              </div>
            </div>

            {/* BUILDER WORKSPACE CONTENT AREA */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* LEFT PALETTE: Draggable Node Library */}
              <div className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-hidden shadow-xs">
                {/* Search Library */}
                <div className="p-4 border-b border-slate-100">
                  <Input
                    prefix={<Search className="w-4 h-4 text-slate-400" />}
                    placeholder="Search node library..."
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    className="rounded-lg border-slate-200 hover:border-indigo-400"
                    allowClear
                  />
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
                  {[
                    { key: 'triggers', title: '📌 Triggers', color: 'blue' },
                    { key: 'approvals', title: '⚙ Approvals', color: 'purple' },
                    { key: 'conditions', title: '🔀 Conditions', color: 'amber' },
                    { key: 'communication', title: '📧 Communication', color: 'emerald' },
                    { key: 'documents', title: '📄 Documents', color: 'cyan' },
                    { key: 'integrations', title: '🔗 Integrations', color: 'rose' },
                    { key: 'utilities', title: '⏱ Utilities', color: 'slate' }
                  ].map((cat) => {
                    const filtered = filteredSidebarNodeList(cat.key);
                    if (filtered.length === 0) return null;

                    return (
                      <div key={cat.key}>
                        <h4 className="text-[10px] font-bold text-slate-450 tracking-wider uppercase mb-2">
                          {cat.title}
                        </h4>
                        <div className="flex flex-col gap-2">
                          {filtered.map((item) => {
                            // Map drag items to valid action types
                            let dragActionType = 'SEND_EMAIL';
                            if (cat.key === 'approvals') dragActionType = 'TRIGGER_APPROVAL';
                            else if (cat.key === 'conditions') dragActionType = 'TRIGGER_APPROVAL'; // Can act as routing gates
                            else if (cat.key === 'integrations') dragActionType = 'WEBHOOK';
                            else if (cat.key === 'utilities') dragActionType = 'ASSIGN_TASK';
                            else if (cat.key === 'documents') dragActionType = 'ASSIGN_TASK';

                            const catBg = {
                              blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:border-blue-500/50',
                              purple: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 hover:border-indigo-500/50',
                              amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:border-amber-500/50',
                              emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:border-emerald-500/50',
                              cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20 hover:border-cyan-500/50',
                              rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:border-rose-500/50',
                              slate: 'bg-slate-500/10 text-slate-500 border-slate-500/20 hover:border-slate-500/50'
                            }[cat.color] || 'bg-slate-50 border-slate-200';

                            return (
                              <div
                                key={item.label}
                                draggable
                                onDragStart={(e) => handleDragStart(e, dragActionType)}
                                onClick={() => {
                                  // Click to add support
                                  if (cat.key === 'triggers') {
                                    setSelectedNode({ type: 'trigger' });
                                    if (item.module) setSelectedModule(item.module);
                                  } else {
                                    addNewAction(dragActionType);
                                  }
                                }}
                                className={`border p-2.5 rounded-xl cursor-grab active:cursor-grabbing transition flex flex-col gap-0.5 select-none bg-white hover:shadow-xs ${catBg}`}
                              >
                                <div className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  {item.label}
                                </div>
                                <div className="text-[10px] text-slate-400 pl-3 leading-relaxed">
                                  {item.desc}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CENTER: n8n style Canvas */}
              <div
                className="flex-1 bg-slate-50 overflow-y-auto p-12 relative flex flex-col items-center"
                style={{
                  backgroundImage: snapGrid ? 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)' : 'none',
                  backgroundSize: '24px 24px'
                }}
              >
                <div
                  className="w-full max-w-lg flex flex-col items-center transition-transform duration-250 origin-top"
                  style={{
                    transform: `scale(${zoom})`
                  }}
                >
                  {/* Visual Align Helper Line */}
                  <div className="absolute top-0 bottom-0 w-[1px] border-l border-dashed border-indigo-250/20 pointer-events-none z-0" />

                  {/* NODE 1: Dynamic Trigger Card (Blue coded) */}
                  <motion.div
                    onClick={() => setSelectedNode({ type: 'trigger' })}
                    className={`w-full bg-white border-l-4 border-l-blue-500 border p-4 rounded-xl shadow-xs cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md relative z-10 ${
                      selectedNode?.type === 'trigger' ? 'border-indigo-500 shadow-indigo-500/10 ring-1 ring-indigo-500' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500 text-white rounded-lg shadow-sm">
                          <Zap className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-blue-500 tracking-wider uppercase">Trigger Node</div>
                          <h3 className="text-sm font-bold text-slate-808 mt-0.5">
                            {MODULE_TRIGGERS[selectedModule]?.find(t => t.value === triggerEvent)?.label || triggerEvent}
                          </h3>
                          <div className="text-[10px] text-slate-450 mt-0.5">
                            Event type: {triggerEvent} | Module: {selectedModule.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Dropdown Options */}
                      <Dropdown
                        trigger={['click']}
                        overlay={
                          <div className="bg-white border border-slate-200 rounded-lg shadow-md p-1 flex flex-col min-w-32">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedNode({ type: 'trigger' }); }}
                              className="px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left rounded"
                            >
                              Configure trigger
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); message.info('Triggers cannot be disabled.'); }}
                              className="px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-slate-450 text-left rounded cursor-not-allowed"
                            >
                              Disable Node
                            </button>
                          </div>
                        }
                      >
                        <button className="text-slate-400 hover:text-slate-650 transition p-1 hover:bg-slate-100 rounded">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </Dropdown>
                    </div>
                  </motion.div>

                  {/* SVG Connection line */}
                  <div className="flex flex-col items-center py-4 select-none relative group z-0">
                    <div className="w-[2px] h-10 bg-indigo-200 group-hover:h-12 transition-all" />
                    <ChevronDown className="w-4 h-4 text-indigo-400 -mt-1.5 bg-slate-50 rounded-full" />
                  </div>

                  {/* NODE 2: Condition Gate (Orange Coded) */}
                  <motion.div
                    onClick={() => setSelectedNode({ type: 'condition' })}
                    className={`w-full bg-white border-l-4 border-l-amber-500 border p-4 rounded-xl shadow-xs cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md relative z-10 ${
                      selectedNode?.type === 'condition' ? 'border-amber-500 shadow-amber-500/10 ring-1 ring-amber-500' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500 text-white rounded-lg shadow-sm">
                          <GitFork className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-amber-500 tracking-wider uppercase">Condition Gate</div>
                          <div className="text-xs font-bold text-slate-700 mt-1">
                            {conditions.length === 0 ? (
                              <span className="text-slate-400 text-xs italic">Apply to all requests (No Filters)</span>
                            ) : (
                              <div className="flex flex-col gap-1 text-[11px] text-amber-650 font-medium mt-1">
                                {conditions.map((c, i) => (
                                  <div key={i}>
                                    • {c.field} {c.operator === 'equals' ? '=' : c.operator === 'not_equals' ? '!=' : c.operator} <strong className="text-slate-800">"{c.value}"</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <Dropdown
                        trigger={['click']}
                        overlay={
                          <div className="bg-white border border-slate-200 rounded-lg shadow-md p-1 flex flex-col min-w-32">
                            <button
                              onClick={(e) => { e.stopPropagation(); addCondition(); }}
                              className="px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left rounded"
                            >
                              Add Condition rule
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConditions([]); message.info('Conditions cleared'); }}
                              className="px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-red-500 text-left rounded"
                            >
                              Clear all rules
                            </button>
                          </div>
                        }
                      >
                        <button className="text-slate-400 hover:text-slate-650 transition p-1 hover:bg-slate-100 rounded">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </Dropdown>
                    </div>
                  </motion.div>

                  {/* SVG Connection line */}
                  <div className="flex flex-col items-center py-4 select-none relative group z-0">
                    <div className="w-[2px] h-10 bg-indigo-200 group-hover:h-12 transition-all" />
                    <ChevronDown className="w-4 h-4 text-indigo-400 -mt-1.5 bg-slate-50 rounded-full" />
                  </div>

                  {/* ACTIONS PIPELINE LIST */}
                  <div className="w-full flex flex-col items-center">
                    {actions.map((act, idx) => {
                      const themeColor = {
                        SEND_EMAIL: 'emerald',
                        TRIGGER_APPROVAL: 'purple',
                        WEBHOOK: 'rose',
                        ASSIGN_TASK: 'cyan'
                      }[act.type] || 'slate';

                      const borderL = {
                        SEND_EMAIL: 'border-l-emerald-500',
                        TRIGGER_APPROVAL: 'border-l-indigo-500',
                        WEBHOOK: 'border-l-rose-500',
                        ASSIGN_TASK: 'border-l-cyan-500'
                      }[act.type] || 'border-l-slate-500';

                      const nodeTitle = {
                        SEND_EMAIL: 'Email Notification',
                        TRIGGER_APPROVAL: act.config.workflowName || 'Approval Step',
                        WEBHOOK: 'Trigger API Webhook',
                        ASSIGN_TASK: act.config.taskName || 'Assign Action Task'
                      }[act.type] || act.type;

                      const nodeSubtext = {
                        SEND_EMAIL: `Template: ${act.config.triggerType || 'Direct SMTP'} | Subject: ${act.config.subject || 'None'}`,
                        TRIGGER_APPROVAL: `Module: ${act.config.moduleKey?.toUpperCase()} | Phases: ${getApprovalSteps(idx).length}`,
                        WEBHOOK: `Target: ${act.config.url || 'No URL Endpoint Configured'}`,
                        ASSIGN_TASK: `Assignee role field: ${act.config.assigneeField}`
                      }[act.type] || '';

                      const Icon = {
                        SEND_EMAIL: Mail,
                        TRIGGER_APPROVAL: UserCheck,
                        WEBHOOK: Globe,
                        ASSIGN_TASK: CheckSquare
                      }[act.type] || HelpCircle;

                      const isSelected = selectedNode?.type === 'action' && selectedNode.index === idx;

                      return (
                        <React.Fragment key={idx}>
                          <motion.div
                            onClick={() => setSelectedNode({ type: 'action', index: idx })}
                            className={`w-full bg-white border-l-4 ${borderL} border p-4 rounded-xl shadow-xs cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md relative z-10 flex items-center justify-between ${
                              isSelected ? 'border-indigo-500 shadow-indigo-500/10 ring-1 ring-indigo-500' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-lg text-white ${
                                themeColor === 'emerald' ? 'bg-emerald-500' :
                                themeColor === 'purple' ? 'bg-indigo-600' :
                                themeColor === 'rose' ? 'bg-rose-500' :
                                'bg-cyan-500'
                              }`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <div className={`text-[10px] font-bold tracking-wider uppercase ${
                                  themeColor === 'emerald' ? 'text-emerald-500' :
                                  themeColor === 'purple' ? 'text-indigo-500' :
                                  themeColor === 'rose' ? 'text-rose-500' :
                                  'text-cyan-500'
                                }`}>
                                  Action Step {idx + 1}
                                </div>
                                <h3 className="text-sm font-bold text-slate-808 mt-0.5">{nodeTitle}</h3>
                                <div className="text-[10px] text-slate-450 mt-0.5 leading-relaxed">
                                  {nodeSubtext}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Dropdown
                                trigger={['click']}
                                overlay={
                                  <div className="bg-white border border-slate-200 rounded-lg shadow-md p-1 flex flex-col min-w-36">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedNode({ type: 'action', index: idx }); }}
                                      className="px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left rounded"
                                    >
                                      Edit Parameters
                                    </button>
                                    <button
                                      onClick={(e) => duplicateAction(idx, e)}
                                      className="px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left rounded"
                                    >
                                      Duplicate Node
                                    </button>
                                    <button
                                      onClick={(e) => moveAction(idx, 'up', e)}
                                      disabled={idx === 0}
                                      className="px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left rounded disabled:opacity-30"
                                    >
                                      Move Up
                                    </button>
                                    <button
                                      onClick={(e) => moveAction(idx, 'down', e)}
                                      disabled={idx === actions.length - 1}
                                      className="px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-slate-700 text-left rounded disabled:opacity-30"
                                    >
                                      Move Down
                                    </button>
                                    <div className="w-full h-px bg-slate-100 my-1" />
                                    <button
                                      onClick={(e) => deleteAction(idx, e)}
                                      className="px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-red-500 text-left rounded"
                                    >
                                      Delete Node
                                    </button>
                                  </div>
                                }
                              >
                                <button className="text-slate-400 hover:text-slate-655 transition p-1 hover:bg-slate-100 rounded">
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </Dropdown>
                            </div>
                          </motion.div>

                          {/* SVG Connection line */}
                          <div className="flex flex-col items-center py-4 select-none relative group z-0">
                            <div className="w-[2px] h-10 bg-indigo-200 group-hover:h-12 transition-all" />
                            <ChevronDown className="w-4 h-4 text-indigo-400 -mt-1.5 bg-slate-50 rounded-full" />
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* End node card */}
                  <div className="w-full max-w-sm bg-slate-100 border border-slate-300 border-dashed p-3 rounded-xl flex items-center justify-center gap-2 text-slate-450 z-10">
                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">End of Workflow Pipeline</span>
                  </div>

                  {/* Drag drop dropzone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`w-full border-2 border-dashed p-5 rounded-xl flex flex-col items-center justify-center transition-all mt-6 z-10 ${
                      isDraggingOver
                        ? 'border-indigo-400 bg-indigo-500/5'
                        : 'border-slate-350 bg-white/70 hover:bg-white text-slate-400 hover:text-indigo-500 hover:border-indigo-300'
                    }`}
                  >
                    <PlusCircle className={`w-7 h-7 ${isDraggingOver ? 'text-indigo-400 animate-bounce' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                    <div className="text-xs font-bold mt-1.5">Drag & Drop new action blocks here</div>
                    <div className="text-[10px] text-slate-400">Or click elements on Left Sidebar to append</div>
                  </div>
                </div>

                {/* Floating Canvas controllers overlay */}
                <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-md px-3 py-2 flex items-center gap-2 select-none z-30">
                  <button
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                    className="p-1 hover:bg-slate-100 rounded text-slate-650 hover:text-slate-900 transition font-bold text-sm w-7 h-7 flex items-center justify-center border border-slate-200 bg-white"
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <span className="text-xs font-black text-slate-700 w-12 text-center font-mono">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                    className="p-1 hover:bg-slate-100 rounded text-slate-650 hover:text-slate-900 transition font-bold text-sm w-7 h-7 flex items-center justify-center border border-slate-200 bg-white"
                    title="Zoom In"
                  >
                    +
                  </button>
                  <div className="w-px h-5 bg-slate-200 mx-1" />
                  <button
                    onClick={() => setZoom(1.0)}
                    className="text-[10px] font-bold text-indigo-650 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition"
                  >
                    Reset
                  </button>
                  <div className="w-px h-5 bg-slate-200 mx-1" />
                  <div className="flex items-center gap-1">
                    <Tooltip title="Toggle Snap Grid">
                      <Button
                        size="small"
                        type={snapGrid ? 'primary' : 'default'}
                        onClick={() => setSnapGrid(!snapGrid)}
                        className={`text-[10px] px-1 bg-${snapGrid ? 'indigo-600' : 'white'} text-${snapGrid ? 'white' : 'slate-500'}`}
                      >
                        Grid
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: Parameters dynamic inspector Accordion */}
              <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto flex flex-col shadow-xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-bold text-slate-800 text-sm">Property Inspector</h3>
                  </div>
                  {selectedNode && (
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {!selectedNode ? (
                  <div className="p-6 text-center text-slate-400 text-xs italic flex-1 flex items-center justify-center">
                    Select a node card on the canvas to configure properties.
                  </div>
                ) : (
                  <Collapse defaultActiveKey={['general', 'conditions', 'sla']} ghost className="custom-accordion">
                    
                    {/* ACCORDION 1: GENERAL CONFIGS */}
                    <Panel header={<span className="font-bold text-xs text-slate-700 uppercase tracking-wider">General settings</span>} key="general">
                      <div className="flex flex-col gap-4 py-1">
                        
                        {/* Trigger Node Parameters */}
                        {selectedNode.type === 'trigger' && (
                          <>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-1">MODULE</label>
                              <Select
                                value={selectedModule}
                                onChange={(val) => {
                                  setSelectedModule(val);
                                  // Auto set first event trigger of module
                                  const events = MODULE_TRIGGERS[val] || [];
                                  if (events.length > 0) {
                                    setTriggerEvent(events[0].value);
                                  }
                                }}
                                className="w-full"
                              >
                                <Option value="leave">Leave Management</Option>
                                <Option value="recruitment">Recruitment / Offer Letters</Option>
                                <Option value="attendance">Attendance & Regularization</Option>
                                <Option value="employee">Employee Lifecycle</Option>
                                <Option value="custom">Custom API Events</Option>
                              </Select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-1">EVENT TRIGGER</label>
                              <Select
                                value={triggerEvent}
                                onChange={setTriggerEvent}
                                className="w-full"
                              >
                                {(MODULE_TRIGGERS[selectedModule] || []).map((t) => (
                                  <Option key={t.value} value={t.value}>{t.label}</Option>
                                ))}
                              </Select>
                              <div className="text-[10px] text-slate-400 mt-2 bg-slate-50 border border-slate-200 rounded p-2 italic leading-relaxed">
                                {MODULE_TRIGGERS[selectedModule]?.find(t => t.value === triggerEvent)?.desc || 'Trigger event desc'}
                              </div>
                            </div>

                            {/* DYNAMIC FIELD PREVIEW UX */}
                            <div className="border-t border-slate-150 pt-3 mt-1">
                              <label className="text-[10px] font-bold text-slate-400 block mb-1.5">VARIABLES AVAILABLE</label>
                              <div className="flex flex-wrap gap-1.5">
                                {(MODULE_FIELDS[selectedModule] || []).map((f) => (
                                  <span key={f.value} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-650 rounded font-semibold text-[10px]" title={f.label}>
                                    {`{{${f.value}}}`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Action Node Parameters */}
                        {selectedNode.type === 'action' && (
                          <>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-1">ACTION CLASS</label>
                              <Select
                                value={actions[selectedNode.index]?.type}
                                onChange={(val) => updateActionType(selectedNode.index, val)}
                                className="w-full"
                              >
                                <Option value="TRIGGER_APPROVAL">Dynamic Approval Routing</Option>
                                <Option value="SEND_EMAIL">Rich SMTP Email Notification</Option>
                                <Option value="WEBHOOK">External API Webhook Request</Option>
                                <Option value="ASSIGN_TASK">Internal Work Activity Task</Option>
                              </Select>
                            </div>

                            {/* DYNAMIC FORM: APPROVAL CONFIGS */}
                            {actions[selectedNode.index]?.type === 'TRIGGER_APPROVAL' && (
                              <div className="flex flex-col gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">WORKFLOW MODULE KEY</label>
                                  <Select
                                    value={actions[selectedNode.index]?.config?.moduleKey || 'leave'}
                                    onChange={(val) => updateActionConfig(selectedNode.index, 'moduleKey', val)}
                                    className="w-full"
                                  >
                                    <Option value="leave">Leave Request</Option>
                                    <Option value="recruitment">Recruitment Offer</Option>
                                    <Option value="employee">Employee Profile Changes</Option>
                                  </Select>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">APPROVAL ENGINE TYPE</label>
                                  <Select
                                    value={actions[selectedNode.index]?.config?.approvalType || 'SEQUENTIAL'}
                                    onChange={(val) => updateActionConfig(selectedNode.index, 'approvalType', val)}
                                    className="w-full"
                                  >
                                    <Option value="SEQUENTIAL">Sequential (Manager → HR → CEO)</Option>
                                    <Option value="PARALLEL">Parallel (All Approvers Must Act)</Option>
                                    <Option value="ANY_ONE">Any One (First Action Resolves)</Option>
                                    <Option value="PERCENTAGE">Percentage Based Approval</Option>
                                  </Select>
                                </div>

                                {actions[selectedNode.index]?.config?.approvalType === 'PERCENTAGE' && (
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1">REQUIRED PERCENTAGE (%)</label>
                                    <InputNumber
                                      min={1}
                                      max={100}
                                      value={actions[selectedNode.index]?.config?.requiredPercentage || 100}
                                      onChange={(val) => updateActionConfig(selectedNode.index, 'requiredPercentage', val || 100)}
                                      className="w-full"
                                    />
                                  </div>
                                )}

                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">WORKFLOW NAME</label>
                                  <Input
                                    value={actions[selectedNode.index]?.config?.workflowName || ''}
                                    onChange={(e) => updateActionConfig(selectedNode.index, 'workflowName', e.target.value)}
                                    placeholder="e.g. Leave Approval Flow"
                                    className="border-slate-200 text-xs font-semibold text-slate-700"
                                  />
                                </div>
                              </div>
                            )}

                            {/* DYNAMIC FORM: EMAIL DESIGNER (No Code Variable tag injector) */}
                            {actions[selectedNode.index]?.type === 'SEND_EMAIL' && (
                              <div className="flex flex-col gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">SMTP TEMPLATE TRIGGER</label>
                                  <Select
                                    value={actions[selectedNode.index]?.config?.triggerType || ''}
                                    onChange={(val) => updateActionConfig(selectedNode.index, 'triggerType', val)}
                                    className="w-full"
                                    placeholder="Choose Template"
                                  >
                                    {emailTemplates.map((t) => (
                                      <Option key={t._id} value={t.triggerType}>{t.name} ({t.triggerType})</Option>
                                    ))}
                                  </Select>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">RECIPIENTS</label>
                                  <div className="flex flex-col gap-1 border border-slate-200 rounded p-2 bg-slate-50">
                                    {['EMPLOYEE', 'MANAGER', 'HR'].map((role) => {
                                      const currentList = actions[selectedNode.index]?.config?.recipients || [];
                                      const checked = currentList.includes(role);
                                      return (
                                        <Checkbox
                                          key={role}
                                          checked={checked}
                                          onChange={(e) => {
                                            const updated = e.target.checked
                                              ? [...currentList, role]
                                              : currentList.filter(r => r !== role);
                                            updateActionConfig(selectedNode.index, 'recipients', updated);
                                          }}
                                          className="text-xs font-semibold text-slate-600"
                                        >
                                          {role === 'EMPLOYEE' ? 'Request Submitter' : role === 'MANAGER' ? 'Reporting Manager' : 'HR Manager'}
                                        </Checkbox>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">SUBJECT LINE</label>
                                  <Input
                                    value={actions[selectedNode.index]?.config?.subject || ''}
                                    onChange={(e) => updateActionConfig(selectedNode.index, 'subject', e.target.value)}
                                    placeholder="Leave Request Approved"
                                    className="border-slate-200 text-xs font-semibold text-slate-700"
                                  />
                                </div>

                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-bold text-slate-400">BODY CONTENT</label>
                                    <span className="text-[9px] text-indigo-500 font-bold">Inject Variable Tag:</span>
                                  </div>
                                  <Input.TextArea
                                    rows={4}
                                    value={actions[selectedNode.index]?.config?.body || ''}
                                    onChange={(e) => updateActionConfig(selectedNode.index, 'body', e.target.value)}
                                    placeholder="Type your email details..."
                                    className="border-slate-200 text-xs text-slate-655"
                                  />
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {['employee_name', 'manager_name', 'leave_days', 'offer_ctc'].map((tag) => (
                                      <button
                                        key={tag}
                                        onClick={() => {
                                          const currentBody = actions[selectedNode.index]?.config?.body || '';
                                          updateActionConfig(selectedNode.index, 'body', currentBody + ` {{${tag}}}`);
                                        }}
                                        className="text-[9px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded font-semibold text-slate-600"
                                      >
                                        +{tag}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Desktop / Mobile HTML preview system */}
                                <div className="border-t border-slate-150 pt-3 mt-1">
                                  <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Live Designer Preview</label>
                                    <Radio.Group
                                      size="small"
                                      value={emailPreviewMode}
                                      onChange={(e) => setEmailPreviewMode(e.target.value)}
                                    >
                                      <Radio.Button value="desktop"><Monitor className="w-3.5 h-3.5 mt-0.5" /></Radio.Button>
                                      <Radio.Button value="mobile"><Smartphone className="w-3.5 h-3.5 mt-0.5" /></Radio.Button>
                                    </Radio.Group>
                                  </div>

                                  <div className={`border border-slate-200 rounded bg-white p-2.5 overflow-hidden shadow-inner ${
                                    emailPreviewMode === 'mobile' ? 'max-w-[200px] mx-auto' : 'w-full'
                                  }`}>
                                    <div className="border-b border-slate-100 pb-1.5 mb-1.5">
                                      <div className="text-[9px] text-slate-450 font-semibold truncate">
                                        <span className="font-bold text-slate-600">Subject:</span> {actions[selectedNode.index]?.config?.subject || 'Approval Notification'}
                                      </div>
                                    </div>
                                    <div className="text-[9px] text-slate-655 leading-relaxed font-sans whitespace-pre-wrap">
                                      {(actions[selectedNode.index]?.config?.body || 'Dear Employee...')
                                        .replace('{{employee_name}}', 'Priyam Dodiya')
                                        .replace('{{manager_name}}', 'Rushik Joshi')
                                        .replace('{{leave_days}}', '5')
                                        .replace('{{offer_ctc}}', 'LPA 12,00,000')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* DYNAMIC FORM: WEBHOOK */}
                            {actions[selectedNode.index]?.type === 'WEBHOOK' && (
                              <div className="flex flex-col gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">TARGET WEBHOOK ENDPOINT URL</label>
                                  <Input
                                    value={actions[selectedNode.index]?.config?.url || ''}
                                    onChange={(e) => updateActionConfig(selectedNode.index, 'url', e.target.value)}
                                    placeholder="https://api.domain.com/sap-sync"
                                    className="border-slate-200 text-xs font-semibold text-slate-700"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">PAYLOAD MAPPING (JSON)</label>
                                  <Input.TextArea
                                    rows={4}
                                    value={actions[selectedNode.index]?.config?.payloadJson || '{}'}
                                    onChange={(e) => updateActionConfig(selectedNode.index, 'payloadJson', e.target.value)}
                                    placeholder='{ "employee": "{{employee_name}}", "status": "approved" }'
                                    className="border-slate-200 text-xs text-slate-700 font-mono"
                                  />
                                </div>
                              </div>
                            )}

                            {/* DYNAMIC FORM: ASSIGN TASK */}
                            {actions[selectedNode.index]?.type === 'ASSIGN_TASK' && (
                              <div className="flex flex-col gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">TASK HEADER TITLE</label>
                                  <Input
                                    value={actions[selectedNode.index]?.config?.taskName || ''}
                                    onChange={(e) => updateActionConfig(selectedNode.index, 'taskName', e.target.value)}
                                    placeholder="Review onboarding clearance documents"
                                    className="border-slate-200 text-xs font-semibold text-slate-700"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">ASSIGNEE OR ROLE TARGET FIELD</label>
                                  <Input
                                    value={actions[selectedNode.index]?.config?.assigneeField || 'employeeId'}
                                    onChange={(e) => updateActionConfig(selectedNode.index, 'assigneeField', e.target.value)}
                                    placeholder="e.g. reporting_manager"
                                    className="border-slate-200 text-xs font-semibold text-slate-700"
                                  />
                                </div>
                              </div>
                            )}

                          </>
                        )}

                      </div>
                    </Panel>

                    {/* ACCORDION 2: CONDITIONS BUILDER */}
                    {selectedNode.type === 'condition' && (
                      <Panel header={<span className="font-bold text-xs text-slate-700 uppercase tracking-wider">Condition Criteria</span>} key="conditions">
                        <div className="flex flex-col gap-4 py-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-450 font-bold uppercase">Visual Rule Builder</span>
                            <button
                              onClick={addCondition}
                              className="text-xs text-indigo-650 hover:text-indigo-700 font-bold flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Rule
                            </button>
                          </div>

                          {conditions.length === 0 ? (
                            <div className="text-center text-xs text-slate-450 italic p-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                              No filter conditions defined. All requests pass automatically.
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4">
                              {conditions.map((c, i) => (
                                <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 relative group">
                                  <button
                                    onClick={() => removeCondition(i)}
                                    className="absolute top-2.5 right-2.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>

                                  <div className="flex flex-col gap-2.5">
                                    <div>
                                      <label className="text-[9px] font-bold text-slate-450 block mb-1">FIELD PATH</label>
                                      <AutoComplete
                                        value={c.field}
                                        onChange={(val) => updateCondition(i, 'field', val)}
                                        options={(MODULE_FIELDS[selectedModule] || []).map((f) => ({ value: f.value, label: f.label }))}
                                        placeholder="daysCount"
                                        className="w-full text-xs font-semibold"
                                        filterOption={(inputValue, option) =>
                                          option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                        }
                                      />
                                    </div>

                                    <div>
                                      <label className="text-[9px] font-bold text-slate-455 block mb-1">OPERATOR</label>
                                      <Select
                                        value={c.operator}
                                        onChange={(val) => updateCondition(i, 'operator', val)}
                                        className="w-full text-xs"
                                      >
                                        <Option value="equals">= (Equals)</Option>
                                        <Option value="not_equals">!= (Not Equals)</Option>
                                        <Option value="contains">Contains</Option>
                                        <Option value="greater_than">&gt; (Greater Than)</Option>
                                        <Option value="less_than">&lt; (Less Than)</Option>
                                      </Select>
                                    </div>

                                    <div>
                                      <label className="text-[9px] font-bold text-slate-455 block mb-1">VALUE TO COMPARE</label>
                                      <Input
                                        value={c.value}
                                        onChange={(e) => updateCondition(i, 'value', e.target.value)}
                                        placeholder="e.g. 5"
                                        className="border-slate-200 text-xs font-semibold text-slate-700"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Nested Logic Visual indicator */}
                              <div className="bg-amber-50 border border-amber-200 text-amber-805 text-[10px] p-2.5 rounded-lg flex flex-col gap-1 italic leading-relaxed">
                                <span className="font-bold uppercase tracking-wider block">Rule Gate Logic:</span>
                                {`IF (${conditions.map(c => `[${c.field}]`).join(' AND ')}) THEN route actions chain.`}
                              </div>
                            </div>
                          )}
                        </div>
                      </Panel>
                    )}

                    {/* ACCORDION 3: APPROVAL PHASES STEPS LIST */}
                    {selectedNode.type === 'action' && actions[selectedNode.index]?.type === 'TRIGGER_APPROVAL' && (
                      <Panel header={<span className="font-bold text-xs text-slate-700 uppercase tracking-wider">Approval Matrix steps</span>} key="sla">
                        <div className="flex flex-col gap-4 py-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-450 font-bold uppercase">Phases List</span>
                            <button
                              onClick={() => addApprovalStep(selectedNode.index)}
                              className="text-xs text-indigo-650 hover:text-indigo-700 font-bold flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Phase
                            </button>
                          </div>

                          <div className="flex flex-col gap-4">
                            {getApprovalSteps(selectedNode.index).map((step, sIdx) => (
                              <div key={`${step.key}-${sIdx}`} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                                <div className="flex justify-between items-center mb-2.5">
                                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Phase {sIdx + 1}</span>
                                  <button
                                    onClick={() => removeApprovalStep(selectedNode.index, sIdx)}
                                    className="text-slate-400 hover:text-red-500 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="flex flex-col gap-2.5">
                                  <Input
                                    value={step.name}
                                    onChange={(e) => updateApprovalStep(selectedNode.index, sIdx, 'name', e.target.value)}
                                    placeholder="Phase Name (e.g. Manager Approval)"
                                    className="border-slate-200 text-xs font-semibold text-slate-700"
                                  />

                                  <div>
                                    <label className="text-[9px] font-bold text-slate-455 block mb-1">APPROVER RESOLUTION</label>
                                    <Select
                                      value={step.approverType}
                                      onChange={(val) => {
                                        updateApprovalStep(selectedNode.index, sIdx, 'approverType', val);
                                        updateApprovalStep(selectedNode.index, sIdx, 'approverValue', val === 'ROLE' ? '' : val);
                                      }}
                                      className="w-full text-xs"
                                    >
                                      {APPROVER_OPTIONS.map(o => (
                                        <Option key={o.value} value={o.value}>{o.label}</Option>
                                      ))}
                                    </Select>
                                  </div>

                                  {step.approverType === 'ROLE' && (
                                    <Input
                                      value={step.approverValue}
                                      onChange={(e) => updateApprovalStep(selectedNode.index, sIdx, 'approverValue', e.target.value)}
                                      placeholder="e.g. finance_head"
                                      className="border-slate-200 text-xs font-semibold text-slate-700"
                                    />
                                  )}

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9px] font-bold text-slate-455 block mb-1">SLA HOURS</label>
                                      <InputNumber
                                        min={1}
                                        value={step.slaHours || 24}
                                        onChange={(val) => updateApprovalStep(selectedNode.index, sIdx, 'slaHours', val || 24)}
                                        className="w-full text-xs font-semibold"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-bold text-slate-455 block mb-1">REMINDER (HRS)</label>
                                      <InputNumber
                                        min={1}
                                        value={step.reminderHours || 12}
                                        onChange={(val) => updateApprovalStep(selectedNode.index, sIdx, 'reminderHours', val || 12)}
                                        className="w-full text-xs font-semibold"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[9px] font-bold text-slate-455 block mb-1">ESCALATE TO IF OVERDUE</label>
                                    <Select
                                      value={step.escalationContact || 'HR Head'}
                                      onChange={(val) => updateApprovalStep(selectedNode.index, sIdx, 'escalationContact', val)}
                                      className="w-full text-xs"
                                    >
                                      <Option value="Reporting Manager">Reporting Manager</Option>
                                      <Option value="Department Head">Department Head</Option>
                                      <Option value="HR Head">HR Head</Option>
                                      <Option value="CEO">CEO / Director</Option>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Panel>
                    )}

                    {/* ACCORDION 4: MOCK AUDIT TRAIL */}
                    <Panel header={<span className="font-bold text-xs text-slate-700 uppercase tracking-wider">Audit logs</span>} key="audit">
                      <div className="flex flex-col gap-2 py-1">
                        <div className="border border-slate-150 rounded bg-slate-50/50 p-2.5 text-[10px] text-slate-505 leading-relaxed">
                          <strong className="text-slate-700 block mb-0.5">Workflow Created</strong>
                          <span>By Admin • June 23, 2026 04:12 PM</span>
                        </div>
                        {historyIndex > 0 && (
                          <div className="border border-slate-150 rounded bg-slate-50/50 p-2.5 text-[10px] text-slate-505 leading-relaxed">
                            <strong className="text-indigo-650 block mb-0.5">Workflow Edited</strong>
                            <span>Action nodes order or parameters modified. History trace active ({historyIndex} commits stack).</span>
                          </div>
                        )}
                      </div>
                    </Panel>

                  </Collapse>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: Simulation Engine Tester */}
      <Modal
        title={<span className="font-bold text-base text-slate-800 flex items-center gap-1.5"><Play className="w-5 h-5 text-indigo-655 animate-pulse" /> Workflow Simulation Test Engine</span>}
        visible={isSimulating}
        onCancel={() => setIsSimulating(false)}
        footer={[
          <Button key="close" onClick={() => setIsSimulating(false)}>Close Simulator</Button>,
          <Button key="run" type="primary" className="bg-indigo-650" onClick={runSimulation} loading={simRunning}>
            Run Simulation
          </Button>
        ]}
        width={600}
        className="custom-modal"
      >
        <div className="flex flex-col gap-5 py-2">
          <Alert
            message="Test automation pipeline variables evaluation and routing behavior without database modification."
            type="info"
            className="text-xs border-indigo-100 bg-indigo-50/40 rounded-lg"
          />

          <div className="grid grid-cols-2 gap-3.5">
            {selectedModule === 'leave' && (
              <>
                <div>
                  <label className="text-[10px] font-bold text-slate-455 block mb-1">LEAVE TYPE</label>
                  <Select
                    value={simParams.leaveType}
                    onChange={(val) => setSimParams({ ...simParams, leaveType: val })}
                    className="w-full"
                  >
                    <Option value="Casual Leave">Casual Leave</Option>
                    <Option value="Sick Leave">Sick Leave</Option>
                    <Option value="Annual Leave">Annual Leave</Option>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-455 block mb-1">LEAVE DAYS</label>
                  <InputNumber
                    min={1}
                    value={simParams.daysCount}
                    onChange={(val) => setSimParams({ ...simParams, daysCount: val || 1 })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-455 block mb-1">LEAVE BALANCE</label>
                  <InputNumber
                    min={0}
                    value={simParams.leaveBalance}
                    onChange={(val) => setSimParams({ ...simParams, leaveBalance: val || 0 })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-455 block mb-1">DEPARTMENT</label>
                  <Select
                    value={simParams.department}
                    onChange={(val) => setSimParams({ ...simParams, department: val })}
                    className="w-full"
                  >
                    <Option value="IT">IT Department</Option>
                    <Option value="HR">HR Team</Option>
                    <Option value="Finance">Finance Control</Option>
                  </Select>
                </div>
              </>
            )}

            {selectedModule === 'recruitment' && (
              <>
                <div>
                  <label className="text-[10px] font-bold text-slate-455 block mb-1">CANDIDATE NAME</label>
                  <Input
                    value={simParams.candidateName || 'Priyam Dodiya'}
                    onChange={(e) => setSimParams({ ...simParams, candidateName: e.target.value })}
                    className="w-full text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-455 block mb-1">OFFER CTC (LPA)</label>
                  <InputNumber
                    min={1}
                    value={simParams.ctc || 12}
                    onChange={(val) => setSimParams({ ...simParams, ctc: val || 1 })}
                    className="w-full text-xs font-semibold"
                  />
                </div>
              </>
            )}
          </div>

          {/* Results tracing UI */}
          <div className="border-t border-slate-150 pt-4">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-3">Simulation Execution Trace Output</h4>
            {simResults.length === 0 ? (
              <div className="text-center text-xs text-slate-400 italic py-6 border border-slate-200 rounded-lg bg-slate-50/50">
                Click "Run Simulation" button to initialize dynamic tests.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
                {simResults.map((r, i) => (
                  <div key={i} className={`border rounded-lg p-3 ${
                    r.status === 'success' ? 'bg-emerald-50/40 border-emerald-100 text-emerald-800' :
                    r.status === 'failed' ? 'bg-rose-50/40 border-rose-100 text-rose-800' :
                    'bg-indigo-50/40 border-indigo-100 text-indigo-808 animate-pulse'
                  }`}>
                    <div className="flex items-center gap-2 font-bold text-xs">
                      {r.status === 'success' && <Check className="w-4 h-4 text-emerald-500" />}
                      {r.status === 'failed' && <X className="w-4 h-4 text-rose-500" />}
                      {r.status === 'pending' && <Clock className="w-4 h-4 text-indigo-500" />}
                      {r.name}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed pl-6">{r.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* DRAWER: Simulated Notification failures Center */}
      <Drawer
        title={<span className="font-bold text-slate-700 flex items-center gap-1.5"><AlertCircle className="w-5 h-5 text-red-500" /> Alerts & Retry Management</span>}
        placement="right"
        onClose={() => setIsAlertDrawerOpen(false)}
        visible={isAlertDrawerOpen}
        width={380}
      >
        <div className="flex flex-col gap-4">
          {alerts.length === 0 ? (
            <div className="text-center text-xs text-slate-400 italic py-12">
              All automation nodes executing perfectly without failures.
            </div>
          ) : (
            alerts.map((a) => (
              <div key={a.id} className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-xs relative flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-150 rounded font-bold text-[9px] uppercase tracking-wider">
                    {a.type}
                  </span>
                  <span className="text-[9px] text-slate-400">{a.time}</span>
                </div>
                <div className="font-bold text-xs text-slate-705">{a.workflow}</div>
                <p className="text-[10px] text-slate-550 leading-relaxed font-mono bg-slate-50 p-2 border rounded border-slate-100">
                  {a.text}
                </p>

                <div className="flex items-center gap-2.5 mt-1 border-t border-slate-100 pt-2.5">
                  <Button
                    size="small"
                    type="primary"
                    className="bg-indigo-605 text-[10px] h-6 flex items-center gap-1"
                    onClick={() => {
                      message.loading(`Initiating retries routing for alert ${a.id}...`, 1.5);
                      setTimeout(() => {
                        message.success('Success! SMTP connection restablished. Action executed.');
                        setAlerts(alerts.filter(item => item.id !== a.id));
                      }, 1600);
                    }}
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Action
                  </Button>
                  <Button
                    size="small"
                    className="text-[10px] h-6"
                    onClick={() => message.info('Visual executions audit logs detailed traces.')}
                  >
                    View Stack Log
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>
    </div>
  );
}
