import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer, Select } from 'antd';
import {
  CheckCircle,
  Eye,
  FileDown,
  Filter,
  IndianRupee,
  Loader,
  Play,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Trash2,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import api from '../../../utils/api';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import PayrollCorrectionModal from '../../../components/Payroll/PayrollCorrectionModal';
import usePagePermissions from '../../../hooks/usePagePermissions';

const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  new Date(0, index).toLocaleString('default', { month: 'long' })
);

const EMPLOYEE_TYPES = ['Full-time', 'Part-time', 'Intern', 'Contract', 'Consultant'];
const WORK_MODES = ['Work From Office (WFO)', 'Work From Home (WFH)', 'Hybrid', 'Field / Onsite'];

const RUN_TYPE_OPTIONS = [
  { value: 'FULL', label: 'Full Monthly Payroll' },
  { value: 'SELECTED', label: 'Selected Employees' },
  { value: 'OFF_CYCLE', label: 'Off-cycle Settlement' },
  { value: 'AMENDMENT', label: 'Amendment Run' },
];

const ATTENDANCE_POLICY_OPTIONS = [
  { value: 'STRICT', label: 'Strict Attendance' },
  { value: 'ALLOW_FALLBACK', label: 'Allow Attendance Fallback' },
];

const INPUT_BATCH_SOURCE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'VARIABLE_PAY', label: 'Variable Pay' },
  { value: 'ARREAR', label: 'Arrear' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
  { value: 'FINAL_SETTLEMENT', label: 'Final Settlement' },
];

const INPUT_BATCH_SCOPE_OPTIONS = [
  { value: 'ANY', label: 'Any Payroll Run' },
  { value: 'MONTHLY', label: 'Monthly Only' },
  { value: 'OFF_CYCLE', label: 'Off-cycle Only' },
  { value: 'AMENDMENT', label: 'Amendment Only' },
];

const INPUT_BATCH_TYPE_OPTIONS = [
  { value: 'BONUS', label: 'Bonus' },
  { value: 'ARREAR', label: 'Arrear' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
  { value: 'VARIABLE_PAY', label: 'Variable Pay' },
  { value: 'FINAL_SETTLEMENT', label: 'Final Settlement' },
  { value: 'MANUAL_EARNING', label: 'Manual Earning' },
  { value: 'MANUAL_DEDUCTION', label: 'Manual Deduction' },
];

const INPUT_BATCH_CLASSIFICATION_OPTIONS = [
  { value: 'EARNING', label: 'Earning' },
  { value: 'PRE_TAX_DEDUCTION', label: 'Pre-tax Deduction' },
  { value: 'POST_TAX_DEDUCTION', label: 'Post-tax Deduction' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
  { value: 'EMPLOYER_CONTRIBUTION', label: 'Employer Contribution' },
];

const createEmptyBatchItem = () => ({
  employeeId: '',
  inputType: 'BONUS',
  classification: 'EARNING',
  name: '',
  amount: '',
  taxable: true,
  affectsBasic: false,
  effectiveDate: '',
  notes: '',
});

const createInitialBatchForm = () => ({
  name: '',
  source: 'MANUAL',
  runScope: 'ANY',
  usagePolicy: 'ONE_TIME',
  payDate: '',
  notes: '',
  items: [createEmptyBatchItem()],
});

const createInitialRunConfig = () => ({
  runType: 'FULL',
  payDate: '',
  attendancePolicy: 'STRICT',
  inputBatchIds: [],
  offCycleReason: '',
  offCycleLabel: '',
  amendmentOfRunId: null,
  selectedEmployeeIds: [],
});

const formatCurrency = (value) => `Rs. ${(Number(value) || 0).toLocaleString('en-IN')}`;

const formatRunType = (runType) =>
  RUN_TYPE_OPTIONS.find((item) => item.value === runType)?.label || runType || 'Payroll Run';

const employeeLabel = (employee) =>
  `${[employee?.firstName, employee?.lastName].filter(Boolean).join(' ') || employee?.name || 'Employee'}${employee?.employeeId ? ` (${employee.employeeId})` : ''}`;

function StatusChip({ status }) {
  const palette = {
    DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
    INITIATED: 'bg-blue-50 text-blue-700 border-blue-200',
    CALCULATED: 'bg-violet-50 text-violet-700 border-violet-200',
    CALCULATED_WITH_ERRORS: 'bg-orange-50 text-orange-700 border-orange-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PAID: 'bg-green-50 text-green-700 border-green-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
    PROCESSING: 'bg-amber-50 text-amber-700 border-amber-200',
    AMENDED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${palette[status] || palette.DRAFT}`}>
      {status}
    </span>
  );
}

function FieldCard({ label, children, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        {hint ? <p className="text-[12px] text-slate-500 mt-1">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  const IconComponent = icon;
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
        <IconComponent size={18} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function RunCard({ run, canEdit, canCreate, onInspect, onPreflight, onCalculate, onSubmitForApproval, onReviewApproval, onGenerateExports, onCorrect, onMarkPaid }) {
  const monthName = MONTH_NAMES[(run.month || 1) - 1];
  const hasPendingApproval = (run.approvalWorkflow || []).some((step) => step?.status === 'PENDING');

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-slate-800">{run.runCode || `${monthName} ${run.year}`}</h3>
            <StatusChip status={run.status} />
            <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {formatRunType(run.runType)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1 text-[12px] text-slate-500">
            <span>Period: {monthName} {run.year}</span>
            <span>Run Date: {run.initiatedAt ? formatDateDDMMYYYY(run.initiatedAt) : 'Not captured'}</span>
            <span>Employees: {run.processedEmployees || 0}/{run.totalEmployees || 0}</span>
            <span>Pay Date: {run.payDate ? formatDateDDMMYYYY(run.payDate) : 'Not assigned'}</span>
            <span>Gross: {formatCurrency(run.totalGross)}</span>
            <span>Net: {formatCurrency(run.totalNetPay)}</span>
            {run.offCycleReason ? <span className="md:col-span-2">Reason: {run.offCycleReason}</span> : null}
          </div>
        </div>

        <button
          onClick={() => onInspect(run)}
          className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-600 transition-all"
        >
          <Eye size={16} />
          Inspect
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {canCreate && ['INITIATED', 'CALCULATED_WITH_ERRORS'].includes(run.status) && (
          <>
            <button
              onClick={() => onPreflight(run)}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-all"
            >
              Preflight
            </button>
            <button
              onClick={() => onCalculate(run)}
              className="h-9 px-3 rounded-xl bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all"
            >
              Calculate
            </button>
          </>
        )}

        {canEdit && run.status === 'CALCULATED' && (
          <button
            onClick={() => onSubmitForApproval(run)}
            className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all inline-flex items-center gap-1.5"
          >
            <Send size={14} />
            Submit
          </button>
        )}

        {canEdit && hasPendingApproval && (
          <>
            <button
              onClick={() => onReviewApproval(run, 'APPROVE')}
              className="h-9 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-[11px] font-bold uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 transition-all"
            >
              Approve Step
            </button>
            <button
              onClick={() => onReviewApproval(run, 'REJECT')}
              className="h-9 px-3 rounded-xl border border-rose-200 bg-rose-50 text-[11px] font-bold uppercase tracking-widest text-rose-700 hover:bg-rose-100 transition-all"
            >
              Reject Step
            </button>
          </>
        )}

        {canEdit && ['CALCULATED', 'APPROVED', 'PAID'].includes(run.status) && (
          <button
            onClick={() => onGenerateExports(run)}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-all inline-flex items-center gap-1.5"
          >
            <FileDown size={14} />
            Exports
          </button>
        )}

        {canEdit && ['APPROVED', 'PAID'].includes(run.status) && (
          <button
            onClick={() => onCorrect(run)}
            className="h-9 px-3 rounded-xl border border-blue-200 bg-blue-50 text-[11px] font-bold uppercase tracking-widest text-blue-700 hover:bg-blue-100 transition-all inline-flex items-center gap-1.5"
          >
            <Settings2 size={14} />
            Correct
          </button>
        )}

        {canEdit && run.status === 'APPROVED' && (
          <button
            onClick={() => onMarkPaid(run._id)}
            className="h-9 px-3 rounded-xl border border-violet-200 bg-violet-50 text-[11px] font-bold uppercase tracking-widest text-violet-700 hover:bg-violet-100 transition-all inline-flex items-center gap-1.5"
          >
            <IndianRupee size={14} />
            Mark Paid
          </button>
        )}

        {run.status === 'PAID' && (
          <span className="h-9 px-3 rounded-xl border border-green-200 bg-green-50 text-[11px] font-bold uppercase tracking-widest text-green-700 inline-flex items-center gap-1.5">
            <CheckCircle size={14} />
            Paid & Posted
          </span>
        )}
      </div>
    </div>
  );
}

export default function RunPayroll() {
  const { canView, canCreate, canEdit, canDelete } = usePagePermissions('payroll.run');
  const canSeeRunHistory = canView || canEdit || canDelete;

  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [runConfig, setRunConfig] = useState(createInitialRunConfig());
  const [runs, setRuns] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [availableDesignations, setAvailableDesignations] = useState([]);
  const [inputBatches, setInputBatches] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
  const [showBatchDrawer, setShowBatchDrawer] = useState(false);
  const [filters, setFilters] = useState({
    employeeType: [],
    workMode: [],
    department: 'All Departments',
    designation: 'All Designations',
  });
  const [matchingCount, setMatchingCount] = useState(null);
  const [fetchingCount, setFetchingCount] = useState(false);
  const [batchForm, setBatchForm] = useState(createInitialBatchForm());

  const [correctionState, setCorrectionState] = useState({ visible: false, run: null });
  const [runInsights, setRunInsights] = useState({
    open: false,
    loading: false,
    run: null,
    preflight: null,
    operationalSummary: null,
    exports: [],
    audit: null,
  });

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ value: employee._id, label: employeeLabel(employee) })),
    [employees]
  );

  const departmentOptions = useMemo(() => ([
    { value: 'All Departments', label: 'All Departments' },
    ...availableDepartments.map((item) => ({ value: item.name, label: item.name })),
  ]), [availableDepartments]);

  const designationOptions = useMemo(() => ([
    { value: 'All Designations', label: 'All Designations' },
    ...availableDesignations.map((item) => ({ value: item, label: item })),
  ]), [availableDesignations]);

  const amendmentRunOptions = useMemo(
    () => runs
      .filter((run) => ['CALCULATED', 'CALCULATED_WITH_ERRORS', 'APPROVED', 'PAID'].includes(run.status))
      .map((run) => ({
        value: run._id,
        label: `${run.runCode || `${MONTH_NAMES[(run.month || 1) - 1]} ${run.year}`} - ${run.status}`,
      })),
    [runs]
  );

  const eligibleBatchOptions = useMemo(
    () => inputBatches
      .filter((batch) => ['APPROVED', 'RELEASED'].includes(batch.status))
      .map((batch) => ({
        value: batch._id,
        label: `${batch.batchCode} | ${batch.name} | ${batch.status}`,
      })),
    [inputBatches]
  );

  const isFilterApplied = filters.employeeType.length > 0
    || filters.workMode.length > 0
    || filters.department !== 'All Departments'
    || filters.designation !== 'All Designations';

  const getErrorMessage = (err, fallback) =>
    err?.response?.data?.message || err?.response?.data?.error || fallback;

  const getPendingApprovalStep = (run) => {
    const steps = Array.isArray(run?.approvalWorkflow) ? [...run.approvalWorkflow] : [];
    return steps
      .filter((step) => step?.status === 'PENDING')
      .sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0))[0] || null;
  };

  const fetchMetadata = useCallback(async () => {
    try {
      const [deptRes, empRes] = await Promise.all([
        api.get('/hr/departments'),
        api.get('/hr/employees'),
      ]);

      const departments = deptRes.data?.data || deptRes.data || [];
      const employeeList = empRes.data?.data || empRes.data || [];
      setAvailableDepartments(departments);
      setEmployees(employeeList);
      setAvailableDesignations([...new Set(employeeList.map((item) => item.designation).filter(Boolean))]);
    } catch (err) {
      console.error('Failed to fetch payroll metadata', err);
      setError('Could not load employee and department metadata.');
    }
  }, []);

  const loadRuns = useCallback(async () => {
    if (!canSeeRunHistory) return;
    try {
      setLoading(true);
      const res = await api.get(`/payroll/runs?year=${selectedYear}`);
      setRuns(res.data?.data || []);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Failed to load payroll runs.'));
    } finally {
      setLoading(false);
    }
  }, [canSeeRunHistory, selectedYear]);

  const loadInputBatches = useCallback(async () => {
    try {
      const res = await api.get(`/payroll/input-batches?month=${selectedMonth}&year=${selectedYear}`);
      const batches = res.data?.data || [];
      setInputBatches(batches);
      setRunConfig((prev) => ({
        ...prev,
        inputBatchIds: prev.inputBatchIds.filter((id) => batches.some((batch) => batch._id === id)),
      }));
    } catch (err) {
      console.error('Failed to load payroll input batches', err);
      setError(getErrorMessage(err, 'Failed to load payroll input batches.'));
    }
  }, [selectedMonth, selectedYear]);

  const updateMatchingCount = useCallback(async () => {
    setFetchingCount(true);
    try {
      const params = new URLSearchParams({
        month: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
        year: selectedYear,
        department: filters.department,
        designation: filters.designation,
        employeeType: filters.employeeType.join(','),
        workMode: filters.workMode.join(','),
      });
      const res = await api.get(`/payroll/filteredEmployees?${params.toString()}`);
      setMatchingCount(res.data?.count || 0);
    } catch (err) {
      console.error('Failed to fetch matching employee count', err);
      setMatchingCount(0);
    } finally {
      setFetchingCount(false);
    }
  }, [filters, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    if (canSeeRunHistory) {
      loadRuns();
    } else {
      setRuns([]);
    }
  }, [canSeeRunHistory, loadRuns]);

  useEffect(() => {
    if (canCreate || canEdit) {
      loadInputBatches();
    } else {
      setInputBatches([]);
    }
  }, [canCreate, canEdit, loadInputBatches]);

  useEffect(() => {
    if (showFilters) {
      updateMatchingCount();
    }
  }, [showFilters, updateMatchingCount]);

  async function openRunInsights(runOrId, options = {}) {
    const runId = typeof runOrId === 'string' ? runOrId : runOrId?._id;
    if (!runId) return;

    const preservePreflight = options.preservePreflight === true;
    const preflightSeed = options.preflight || null;
    const seedRun = typeof runOrId === 'object' ? runOrId : null;

    setRunInsights((prev) => ({
      ...prev,
      open: true,
      loading: true,
      run: seedRun || prev.run,
      preflight: preservePreflight ? (preflightSeed || prev.preflight) : null,
    }));

    const [summaryRes, exportsRes, auditRes] = await Promise.allSettled([
      api.get(`/payroll/runs/${runId}/summary`),
      api.get(`/payroll/runs/${runId}/exports`),
      api.get(`/payroll/runs/${runId}/audit`),
    ]);

    setRunInsights((prev) => ({
      ...prev,
      loading: false,
      run: summaryRes.status === 'fulfilled'
        ? (summaryRes.value?.data?.data?.payrollRun || seedRun || prev.run)
        : (seedRun || prev.run),
      operationalSummary: summaryRes.status === 'fulfilled' ? (summaryRes.value?.data?.data || null) : null,
      exports: exportsRes.status === 'fulfilled' ? (exportsRes.value?.data?.data || []) : [],
      audit: auditRes.status === 'fulfilled' ? (auditRes.value?.data?.data || null) : null,
    }));
  }

  function buildRunPayload(isFiltered = false) {
    const executionMode = runConfig.runType === 'OFF_CYCLE'
      ? 'OFF_CYCLE'
      : runConfig.runType === 'AMENDMENT'
        ? 'AMENDMENT'
        : 'MONTHLY';

    return {
      month: selectedMonth,
      year: selectedYear,
      isFiltered,
      filters: isFiltered ? filters : {},
      runType: runConfig.runType,
      executionMode,
      payDate: runConfig.payDate || null,
      inputBatchIds: runConfig.inputBatchIds,
      attendancePolicy: runConfig.attendancePolicy,
      offCycleReason: runConfig.runType === 'OFF_CYCLE' ? runConfig.offCycleReason : '',
      offCycleLabel: runConfig.runType === 'OFF_CYCLE' ? runConfig.offCycleLabel : '',
      amendmentOfRunId: runConfig.runType === 'AMENDMENT' ? runConfig.amendmentOfRunId : null,
      selectedEmployeeIds: runConfig.runType === 'SELECTED' ? runConfig.selectedEmployeeIds : [],
    };
  }

  async function handleInitiate(isFiltered = false) {
    if (!canCreate) return;

    if (runConfig.runType === 'SELECTED' && runConfig.selectedEmployeeIds.length === 0) {
      setError('Select at least one employee for a selected payroll run.');
      return;
    }
    if (runConfig.runType === 'AMENDMENT' && !runConfig.amendmentOfRunId) {
      setError('Choose the base payroll run that this amendment should correct.');
      return;
    }
    if (runConfig.runType === 'OFF_CYCLE' && runConfig.inputBatchIds.length === 0 && !runConfig.offCycleReason.trim()) {
      setError('Provide an off-cycle reason or attach at least one payroll input batch.');
      return;
    }

    setCalculating(true);
    setError('');
    setSuccess('');

    try {
      const initRes = await api.post('/payroll/runs', buildRunPayload(isFiltered));
      const runId = initRes.data?.data?._id;
      if (runId) {
        const preflightRes = await api.post(`/payroll/runs/${runId}/preflight`);
        await api.post(`/payroll/runs/${runId}/calculate`);
        setSuccess(`${formatRunType(runConfig.runType)} for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} calculated successfully.`);
        setShowFilters(false);
        await Promise.all([loadRuns(), loadInputBatches()]);
        await openRunInsights(runId, { preservePreflight: true, preflight: preflightRes.data?.data || null });
      }
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Failed to run payroll.'));
    } finally {
      setCalculating(false);
    }
  }

  async function handlePreflight(run) {
    if (!run?._id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.post(`/payroll/runs/${run._id}/preflight`);
      const preflight = response.data?.data || null;
      const blockers = preflight?.blockers?.length || 0;
      const warnings = preflight?.warnings?.length || 0;

      if (blockers > 0) {
        setError(`Preflight found ${blockers} blocker(s) and ${warnings} warning(s).`);
      } else {
        setSuccess(`Preflight passed with ${warnings} warning(s).`);
      }

      await openRunInsights(run, { preservePreflight: true, preflight });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to run preflight.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculate(run) {
    if (!canCreate || !run?._id) return;
    if (!window.confirm(`Calculate payroll for ${MONTH_NAMES[(run.month || 1) - 1]} ${run.year}?`)) return;

    setCalculating(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/payroll/runs/${run._id}/calculate`);
      setSuccess('Payroll calculation completed successfully.');
      await loadRuns();
      await openRunInsights(run._id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to calculate payroll.'));
    } finally {
      setCalculating(false);
    }
  }

  async function handleSubmitForApproval(run) {
    if (!canEdit || !run?._id) return;
    const commentInput = window.prompt('Optional submission note for approvers:', '');
    if (commentInput === null) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/payroll/runs/${run._id}/submit-approval`, {
        comment: String(commentInput || '').trim(),
      });
      setSuccess('Payroll submitted for approval.');
      await loadRuns();
      await openRunInsights(run._id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit payroll for approval.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewApproval(run, decision) {
    if (!canEdit || !run?._id) return;
    const pendingStep = getPendingApprovalStep(run);
    if (!pendingStep) {
      setError('No pending approval step found for this payroll run.');
      return;
    }

    const isReject = decision === 'REJECT';
    const commentInput = window.prompt(
      isReject
        ? `Reason to reject step ${pendingStep.order} (${pendingStep.label || 'Approval Step'})`
        : `Optional approval comment for step ${pendingStep.order} (${pendingStep.label || 'Approval Step'})`,
      ''
    );
    if (commentInput === null) return;

    const comment = String(commentInput || '').trim();
    if (isReject && !comment) {
      setError('Rejection comment is required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/payroll/runs/${run._id}/review-approval`, {
        decision,
        stepOrder: pendingStep.order,
        comment,
      });
      setSuccess(isReject ? 'Payroll run rejected.' : `Approval step ${pendingStep.order} completed.`);
      await loadRuns();
      await openRunInsights(run._id);
    } catch (err) {
      setError(getErrorMessage(err, `Failed to ${isReject ? 'reject' : 'approve'} payroll run.`));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateExports(run) {
    if (!canEdit || !run?._id) return;
    if (!window.confirm('Generate payroll exports for bank transfer, compliance, and accounting?')) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.post(`/payroll/runs/${run._id}/generate-exports`, {});
      const count = response.data?.count || response.data?.data?.length || 0;
      setSuccess(`Generated ${count} payroll export artifact(s).`);
      await openRunInsights(run._id);
      await loadRuns();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate payroll exports.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid(runId) {
    if (!canEdit) return;
    if (!window.confirm('Mark this payroll as paid?')) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/payroll/runs/${runId}/mark-paid`);
      setSuccess('Payroll marked as paid successfully.');
      await loadRuns();
      await openRunInsights(runId);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to mark payroll as paid.'));
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setFilters({
      employeeType: [],
      workMode: [],
      department: 'All Departments',
      designation: 'All Designations',
    });
  }

  function updateBatchItem(index, patch) {
    setBatchForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addBatchItem() {
    setBatchForm((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyBatchItem()],
    }));
  }

  function removeBatchItem(index) {
    setBatchForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function handleCreateInputBatch() {
    if (!canCreate) return;

    const validItems = batchForm.items
      .filter((item) => item.employeeId && item.name.trim() && Number(item.amount) > 0)
      .map((item) => ({
        employeeId: item.employeeId,
        inputType: item.inputType,
        classification: item.classification,
        name: item.name.trim(),
        amount: Number(item.amount),
        quantity: 1,
        taxable: item.taxable,
        affectsBasic: item.affectsBasic,
        effectiveDate: item.effectiveDate || null,
        notes: item.notes || '',
      }));

    if (!batchForm.name.trim()) {
      setError('Input batch name is required.');
      return;
    }
    if (validItems.length === 0) {
      setError('Add at least one valid payroll input item.');
      return;
    }

    setBatchSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/payroll/input-batches', {
        name: batchForm.name.trim(),
        source: batchForm.source,
        runScope: batchForm.runScope,
        usagePolicy: batchForm.usagePolicy,
        month: selectedMonth,
        year: selectedYear,
        payDate: batchForm.payDate || runConfig.payDate || null,
        notes: batchForm.notes,
        items: validItems,
      });
      setSuccess('Payroll input batch created successfully.');
      setBatchForm(createInitialBatchForm());
      await loadInputBatches();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Failed to create payroll input batch.'));
    } finally {
      setBatchSaving(false);
    }
  }

  async function handleBatchTransition(batch, action) {
    if (!batch?._id) return;

    const requiresReason = action === 'REJECT';
    const comment = window.prompt(
      requiresReason ? `Reason for ${action.toLowerCase()}ing ${batch.batchCode}` : `Optional note for ${action.toLowerCase()}ing ${batch.batchCode}`,
      ''
    );
    if (comment === null) return;
    if (requiresReason && !String(comment || '').trim()) {
      setError('A reason is required when rejecting a payroll input batch.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/payroll/input-batches/${batch._id}/transition`, {
        action,
        comment: String(comment || '').trim(),
      });
      setSuccess(`${batch.batchCode} moved to ${action}.`);
      await loadInputBatches();
    } catch (err) {
      setError(getErrorMessage(err, `Failed to ${action.toLowerCase()} payroll input batch.`));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionTitle
            icon={PlayCircle}
            title="Payroll Run Control"
            subtitle="Run monthly payroll, release off-cycle settlements, and manage amendment payroll from one flow."
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadRuns}
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {(canCreate || canEdit) && (
              <button
                onClick={() => setShowBatchDrawer(true)}
                className="h-10 px-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-600 transition-all"
              >
                <WalletCards size={16} />
                Input Batches
              </button>
            )}
          </div>
        </div>
      </div>

      {(error || success) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || success}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
            <SectionTitle
              icon={Play}
              title="Run Setup"
              subtitle="Choose the payroll period, run type, and the supporting India payroll data needed for this execution."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <FieldCard label="Month">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                >
                  {MONTH_NAMES.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </FieldCard>

              <FieldCard label="Year">
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                />
              </FieldCard>

              <FieldCard label="Run Type">
                <select
                  value={runConfig.runType}
                  onChange={(e) => setRunConfig((prev) => ({ ...prev, runType: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                >
                  {RUN_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </FieldCard>

              <FieldCard label="Attendance Policy">
                <select
                  value={runConfig.attendancePolicy}
                  onChange={(e) => setRunConfig((prev) => ({ ...prev, attendancePolicy: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                >
                  {ATTENDANCE_POLICY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </FieldCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldCard label="Pay Date" hint="Recommended for off-cycle and amendment runs.">
                <input
                  type="date"
                  value={runConfig.payDate}
                  onChange={(e) => setRunConfig((prev) => ({ ...prev, payDate: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                />
              </FieldCard>

              <FieldCard label="Payroll Input Batches" hint="Attach approved or released bonus, arrear, reimbursement, or FNF batches.">
                <Select
                  mode="multiple"
                  className="w-full"
                  value={runConfig.inputBatchIds}
                  onChange={(value) => setRunConfig((prev) => ({ ...prev, inputBatchIds: value }))}
                  options={eligibleBatchOptions}
                  placeholder="Select input batches"
                  maxTagCount="responsive"
                />
              </FieldCard>
            </div>

            {runConfig.runType === 'SELECTED' && (
              <FieldCard label="Selected Employees" hint="Use this for controlled reruns or targeted processing.">
                <Select
                  mode="multiple"
                  className="w-full"
                  value={runConfig.selectedEmployeeIds}
                  onChange={(value) => setRunConfig((prev) => ({ ...prev, selectedEmployeeIds: value }))}
                  options={employeeOptions}
                  placeholder="Choose employees"
                  maxTagCount="responsive"
                />
              </FieldCard>
            )}

            {runConfig.runType === 'OFF_CYCLE' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldCard label="Off-cycle Reason">
                  <input
                    type="text"
                    value={runConfig.offCycleReason}
                    onChange={(e) => setRunConfig((prev) => ({ ...prev, offCycleReason: e.target.value }))}
                    placeholder="FNF settlement, arrears, ex-gratia, reimbursement"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                  />
                </FieldCard>

                <FieldCard label="Off-cycle Label">
                  <input
                    type="text"
                    value={runConfig.offCycleLabel}
                    onChange={(e) => setRunConfig((prev) => ({ ...prev, offCycleLabel: e.target.value }))}
                    placeholder="April FNF batch or Bonus correction"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                  />
                </FieldCard>
              </div>
            )}

            {runConfig.runType === 'AMENDMENT' && (
              <FieldCard label="Amend Payroll Run" hint="Pick the original run that this amendment should correct.">
                <Select
                  className="w-full"
                  value={runConfig.amendmentOfRunId}
                  onChange={(value) => setRunConfig((prev) => ({ ...prev, amendmentOfRunId: value }))}
                  options={amendmentRunOptions}
                  placeholder="Select an approved or paid run"
                />
              </FieldCard>
            )}

            <div className="flex flex-wrap gap-3">
              {canCreate && (
                <button
                  onClick={() => handleInitiate(false)}
                  disabled={calculating}
                  className="h-11 px-5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {calculating ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
                  Run {formatRunType(runConfig.runType)}
                </button>
              )}

              {canCreate && runConfig.runType === 'FULL' && (
                <button
                  onClick={() => setShowFilters(true)}
                  className={`h-11 px-5 rounded-xl border text-sm font-semibold transition-all inline-flex items-center gap-2 ${
                    isFilterApplied ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
                  }`}
                >
                  <Filter size={16} />
                  Run Filtered Monthly Payroll
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
            <SectionTitle
              icon={Users}
              title="Run History"
              subtitle="Review processed payroll runs, approvals, exports, and downstream payment actions."
            />

            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader size={20} className="animate-spin text-indigo-600" />
              </div>
            ) : runs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                No payroll runs found for {selectedYear}.
              </div>
            ) : (
              <div className="space-y-4">
                {runs.map((run) => (
                  <RunCard
                    key={run._id}
                    run={run}
                    canEdit={canEdit}
                    canCreate={canCreate}
                    onInspect={openRunInsights}
                    onPreflight={handlePreflight}
                    onCalculate={handleCalculate}
                    onSubmitForApproval={handleSubmitForApproval}
                    onReviewApproval={handleReviewApproval}
                    onGenerateExports={handleGenerateExports}
                    onCorrect={(selectedRun) => setCorrectionState({ visible: true, run: selectedRun })}
                    onMarkPaid={handleMarkPaid}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <SectionTitle
              icon={WalletCards}
              title="Selected Input Batches"
              subtitle="These approved batches will flow into the next payroll calculation."
            />

            {runConfig.inputBatchIds.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-500">
                No input batch selected. Use this for bonus, arrears, reimbursements, FNF, or amendment adjustments.
              </div>
            ) : (
              <div className="space-y-3">
                {runConfig.inputBatchIds.map((batchId) => {
                  const batch = inputBatches.find((item) => item._id === batchId);
                  if (!batch) return null;
                  return (
                    <div key={batchId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{batch.batchCode}</p>
                          <p className="text-[12px] text-slate-500">{batch.name}</p>
                        </div>
                        <StatusChip status={batch.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                        <span>Scope: {batch.runScope}</span>
                        <span>Source: {batch.source}</span>
                        <span>Employees: {batch.summary?.employeeCount || 0}</span>
                        <span>Items: {batch.summary?.itemCount || 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <SectionTitle
              icon={IndianRupee}
              title="India Payroll Coverage"
              subtitle="This run flow now supports regular monthly payroll, off-cycle settlements, amendments, and payroll input batches."
            />

            <div className="space-y-3 text-[12px] text-slate-600">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="font-semibold text-slate-800">Monthly</p>
                <p>Run full payroll with attendance policy, statutory rules, and employee-level compensation snapshots.</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="font-semibold text-slate-800">Off-cycle</p>
                <p>Attach arrears, reimbursements, final settlement, and ex-gratia batches directly to payroll.</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="font-semibold text-slate-800">Amendment</p>
                <p>Point back to an earlier run and process corrections without rerunning the whole month blindly.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Drawer
        placement="right"
        width={420}
        open={showFilters}
        onClose={() => setShowFilters(false)}
        closable={false}
        styles={{
          body: { padding: 20, background: '#f8fafc' },
          header: { display: 'none' },
          footer: { padding: '16px 20px', borderTop: '1px solid #e2e8f0' },
        }}
        footer={(
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500">Matching Employees</span>
              {fetchingCount ? <Loader size={14} className="animate-spin text-indigo-600" /> : <span className="font-bold text-slate-800">{matchingCount ?? '--'}</span>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearFilters}
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-rose-200 hover:text-rose-600 transition-all"
              >
                Clear
              </button>
              <button
                onClick={() => handleInitiate(true)}
                disabled={calculating || matchingCount === 0}
                className="flex-[2] h-10 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {calculating ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
                Run Filtered Payroll
              </button>
            </div>
          </div>
        )}
      >
        <div className="flex items-center justify-between mb-5">
          <SectionTitle
            icon={Filter}
            title="Filter Employees"
            subtitle="Scope a monthly run to a filtered employee cohort."
          />
          <button
            onClick={() => setShowFilters(false)}
            className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <FieldCard label="Department">
            <Select
              className="w-full"
              value={filters.department}
              onChange={(value) => setFilters((prev) => ({ ...prev, department: value }))}
              options={departmentOptions}
            />
          </FieldCard>

          <FieldCard label="Designation">
            <Select
              className="w-full"
              value={filters.designation}
              onChange={(value) => setFilters((prev) => ({ ...prev, designation: value }))}
              options={designationOptions}
            />
          </FieldCard>

          <FieldCard label="Employee Type">
            <Select
              mode="multiple"
              className="w-full"
              value={filters.employeeType}
              onChange={(value) => setFilters((prev) => ({ ...prev, employeeType: value }))}
              options={EMPLOYEE_TYPES.map((item) => ({ value: item, label: item }))}
            />
          </FieldCard>

          <FieldCard label="Work Mode">
            <Select
              mode="multiple"
              className="w-full"
              value={filters.workMode}
              onChange={(value) => setFilters((prev) => ({ ...prev, workMode: value }))}
              options={WORK_MODES.map((item) => ({ value: item, label: item }))}
            />
          </FieldCard>
        </div>
      </Drawer>

      <Drawer
        placement="right"
        width={520}
        open={showBatchDrawer}
        onClose={() => setShowBatchDrawer(false)}
        title={null}
        styles={{ body: { padding: 20, background: '#f8fafc' } }}
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle
              icon={WalletCards}
              title="Payroll Input Batches"
              subtitle="Create and release India payroll adjustments such as bonus, arrears, reimbursement, or FNF."
            />
            <button
              onClick={() => setShowBatchDrawer(false)}
              className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Create Batch</h3>
              <button
                onClick={handleCreateInputBatch}
                disabled={batchSaving}
                className="h-9 px-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-60 inline-flex items-center gap-2"
              >
                {batchSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                Save Batch
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldCard label="Batch Name">
                <input
                  type="text"
                  value={batchForm.name}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="April Bonus Upload"
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                />
              </FieldCard>

              <FieldCard label="Source">
                <select
                  value={batchForm.source}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, source: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                >
                  {INPUT_BATCH_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </FieldCard>

              <FieldCard label="Run Scope">
                <select
                  value={batchForm.runScope}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, runScope: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                >
                  {INPUT_BATCH_SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </FieldCard>

              <FieldCard label="Pay Date">
                <input
                  type="date"
                  value={batchForm.payDate}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, payDate: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                />
              </FieldCard>
            </div>

            <FieldCard label="Notes">
              <textarea
                rows={3}
                value={batchForm.notes}
                onChange={(e) => setBatchForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 resize-none"
                placeholder="Explain why this batch is being added to payroll."
              />
            </FieldCard>

            <div className="space-y-3">
              {batchForm.items.map((item, index) => (
                <div key={`batch-item-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Input Item {index + 1}</p>
                    {batchForm.items.length > 1 && (
                      <button
                        onClick={() => removeBatchItem(index)}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <Select
                    className="w-full"
                    value={item.employeeId || undefined}
                    onChange={(value) => updateBatchItem(index, { employeeId: value })}
                    options={employeeOptions}
                    placeholder="Choose employee"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={item.inputType}
                      onChange={(e) => updateBatchItem(index, { inputType: e.target.value })}
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                    >
                      {INPUT_BATCH_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>

                    <select
                      value={item.classification}
                      onChange={(e) => updateBatchItem(index, { classification: e.target.value })}
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                    >
                      {INPUT_BATCH_CLASSIFICATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateBatchItem(index, { name: e.target.value })}
                      placeholder="Component label"
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                    />
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateBatchItem(index, { amount: e.target.value })}
                      placeholder="Amount"
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={item.effectiveDate}
                      onChange={(e) => updateBatchItem(index, { effectiveDate: e.target.value })}
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                    />
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => updateBatchItem(index, { notes: e.target.value })}
                      placeholder="Notes"
                      className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 text-[12px] text-slate-600">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.taxable}
                        onChange={(e) => updateBatchItem(index, { taxable: e.target.checked })}
                      />
                      Taxable
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.affectsBasic}
                        onChange={(e) => updateBatchItem(index, { affectsBasic: e.target.checked })}
                      />
                      Affects Basic
                    </label>
                  </div>
                </div>
              ))}

              <button
                onClick={addBatchItem}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-600 transition-all inline-flex items-center gap-2"
              >
                <Plus size={16} />
                Add Item
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Existing Batches</h3>
              <button
                onClick={loadInputBatches}
                className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {inputBatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-500">
                No input batches found for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
              </div>
            ) : (
              <div className="space-y-3">
                {inputBatches.map((batch) => (
                  <div key={batch._id} className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{batch.batchCode}</p>
                        <p className="text-[12px] text-slate-500">{batch.name}</p>
                      </div>
                      <StatusChip status={batch.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <span>Source: {batch.source}</span>
                      <span>Scope: {batch.runScope}</span>
                      <span>Employees: {batch.summary?.employeeCount || 0}</span>
                      <span>Items: {batch.summary?.itemCount || 0}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {batch.status === 'DRAFT' && (
                        <button onClick={() => handleBatchTransition(batch, 'SUBMIT')} className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-all">Submit</button>
                      )}
                      {batch.status === 'PENDING_APPROVAL' && (
                        <>
                          <button onClick={() => handleBatchTransition(batch, 'APPROVE')} className="h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-[10px] font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-100 transition-all">Approve</button>
                          <button onClick={() => handleBatchTransition(batch, 'REJECT')} className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-[10px] font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-100 transition-all">Reject</button>
                        </>
                      )}
                      {batch.status === 'APPROVED' && (
                        <button onClick={() => handleBatchTransition(batch, 'RELEASE')} className="h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-[10px] font-bold uppercase tracking-wider text-indigo-700 hover:bg-indigo-100 transition-all">Release</button>
                      )}
                      {!['CANCELLED', 'RELEASED'].includes(batch.status) && (
                        <button onClick={() => handleBatchTransition(batch, 'CANCEL')} className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:border-rose-200 hover:text-rose-600 transition-all">Cancel</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      <Drawer
        placement="right"
        width={560}
        open={runInsights.open}
        onClose={() => setRunInsights((prev) => ({ ...prev, open: false }))}
        title={null}
        styles={{ body: { padding: 20, background: '#f8fafc' } }}
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle
              icon={Eye}
              title="Payroll Run Insight"
              subtitle="Inspect diagnostics, linked exports, and approval flow for the selected run."
            />
            <button
              onClick={() => setRunInsights((prev) => ({ ...prev, open: false }))}
              className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {runInsights.loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 flex justify-center">
              <Loader size={20} className="animate-spin text-indigo-600" />
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{runInsights.run?.runCode || 'Payroll Run'}</p>
                    <p className="text-[12px] text-slate-500">
                      {MONTH_NAMES[(runInsights.run?.month || 1) - 1]} {runInsights.run?.year || selectedYear}
                    </p>
                  </div>
                  {runInsights.run?.status ? <StatusChip status={runInsights.run.status} /> : null}
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12px] text-slate-500">
                  <span>Run Type: {formatRunType(runInsights.run?.runType)}</span>
                  <span>Pay Date: {runInsights.run?.payDate ? formatDateDDMMYYYY(runInsights.run.payDate) : 'Not assigned'}</span>
                  <span>Attendance: {runInsights.run?.attendancePolicy || 'STRICT'}</span>
                  <span>Sequence: {runInsights.run?.sequenceNo || 1}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InsightTile label="Employees" value={runInsights.operationalSummary?.totals?.employees || 0} />
                <InsightTile label="Payslips" value={runInsights.operationalSummary?.totals?.generatedPayslips || 0} />
                <InsightTile label="Input Earnings" value={formatCurrency(runInsights.operationalSummary?.totals?.variableInputs || 0)} />
                <InsightTile label="Exceptions" value={runInsights.operationalSummary?.totals?.exceptionFlags || 0} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Preflight</h4>
                {!runInsights.preflight ? (
                  <p className="text-[12px] text-slate-500">Run preflight from the actions panel to load blockers and warnings.</p>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${runInsights.preflight.canCalculate ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {runInsights.preflight.canCalculate ? 'Ready' : 'Blocked'}
                      </span>
                      <span className="text-[12px] text-slate-500">
                        {(runInsights.preflight.blockers || []).length} blocker(s), {(runInsights.preflight.warnings || []).length} warning(s)
                      </span>
                    </div>
                    {(runInsights.preflight.blockers || []).slice(0, 4).map((item, index) => (
                      <p key={`blocker-${index}`} className="text-[12px] text-rose-700 font-medium">
                        {item.name || item.employeeCode || 'Run'}: {item.message}
                      </p>
                    ))}
                    {(runInsights.preflight.warnings || []).slice(0, 3).map((item, index) => (
                      <p key={`warning-${index}`} className="text-[12px] text-amber-700 font-medium">
                        {item.name || item.employeeCode || 'Run'}: {item.message}
                      </p>
                    ))}
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Approval Workflow</h4>
                {(runInsights.run?.approvalWorkflow || []).length === 0 ? (
                  <p className="text-[12px] text-slate-500">No approval workflow attached to this run.</p>
                ) : (
                  <div className="space-y-2">
                    {(runInsights.run?.approvalWorkflow || []).map((step) => (
                      <div key={`${step.order}-${step.label}`} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Step {step.order}: {step.label || 'Approval'}</p>
                          <p className="text-[12px] text-slate-500">{step.role || 'Approver'} | {step.status}</p>
                        </div>
                        <StatusChip status={step.status || 'PENDING'} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Export Artifacts</h4>
                {runInsights.exports.length === 0 ? (
                  <p className="text-[12px] text-slate-500">No exports generated yet.</p>
                ) : (
                  <div className="space-y-2">
                    {runInsights.exports.map((artifact) => (
                      <div key={artifact._id} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-800">{artifact.artifactType}</p>
                        <p className="text-[12px] text-slate-500">
                          {artifact.status} | {artifact.fileName || 'artifact.csv'} | rows: {artifact.rowCount || 0}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Drawer>

      <PayrollCorrectionModal
        visible={correctionState.visible}
        onCancel={() => setCorrectionState({ visible: false, run: null })}
        payrollRun={correctionState.run}
      />
    </div>
  );
}

function InsightTile({ label, value }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all duration-300 group flex flex-col justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 bg-slate-500 opacity-5 blur-2xl rounded-full -mr-8 -mt-8 group-hover:opacity-10 transition-opacity duration-300" />
      <p className="text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1 opacity-80 relative z-10">{label}</p>
      <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none relative z-10">{value}</p>
    </div>
  );
}
