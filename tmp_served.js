import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/Employee/AttendanceModule.jsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=4145a5c5"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
var _s = $RefreshSig$();
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=4145a5c5"; const React = __vite__cjsImport1_react.__esModule ? __vite__cjsImport1_react.default : __vite__cjsImport1_react; const useState = __vite__cjsImport1_react["useState"]; const useEffect = __vite__cjsImport1_react["useEffect"]; const useMemo = __vite__cjsImport1_react["useMemo"];
import { useLocation, useNavigate } from "/node_modules/.vite/deps/react-router-dom.js?v=4145a5c5";
import __vite__cjsImport3_reactDom from "/node_modules/.vite/deps/react-dom.js?v=4145a5c5"; const createPortal = __vite__cjsImport3_reactDom["createPortal"];
import {
  Calendar as CalendarIcon,
  Clock,
  FileText,
  Plus,
  CheckCircle,
  AlertCircle,
  XCircle,
  TrendingUp,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Info,
  Send,
  History,
  ClipboardList,
  Plane,
  ShieldCheck,
  DollarSign
} from "/node_modules/.vite/deps/lucide-react.js?v=4145a5c5";
import api from "/src/utils/api.js";
import AttendanceCalendar from "/src/components/AttendanceCalendar.jsx";
import ClientMeetingTracker from "/src/components/attendance/ClientMeetingTracker.jsx";
import ApplyLeaveForm from "/src/components/ApplyLeaveForm.jsx";
import { formatDateDDMMYYYY } from "/src/utils/dateUtils.js";
import { Pagination, Empty } from "/node_modules/.vite/deps/antd.js?v=4145a5c5";
import __vite__cjsImport11_dayjs from "/node_modules/.vite/deps/dayjs.js?v=4145a5c5"; const dayjs = __vite__cjsImport11_dayjs.__esModule ? __vite__cjsImport11_dayjs.default : __vite__cjsImport11_dayjs;
import clsx from "/node_modules/.vite/deps/clsx.js?v=4145a5c5";
import { useRBAC } from "/src/context/RBACContext.jsx";
import { isEmployeePendingActivation } from "/src/utils/employeeProfile.js";
const SectionHeading = ({ title, subtitle }) => /* @__PURE__ */ jsxDEV("div", { className: "mb-1.5", children: [
  /* @__PURE__ */ jsxDEV("h3", { className: "text-[14px] font-semibold text-[#334155] leading-tight mb-0.5", children: title }, void 0, false, {
    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
    lineNumber: 37,
    columnNumber: 5
  }, this),
  subtitle && /* @__PURE__ */ jsxDEV("p", { className: "text-[#64748B] text-[10px] font-medium opacity-80", children: subtitle }, void 0, false, {
    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
    lineNumber: 38,
    columnNumber: 18
  }, this)
] }, void 0, true, {
  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
  lineNumber: 36,
  columnNumber: 1
}, this);
_c = SectionHeading;
const TabButton = ({ active, label, onClick }) => /* @__PURE__ */ jsxDEV(
  "button",
  {
    onClick,
    className: clsx(
      "relative flex items-center gap-2 px-4 py-0.5 border-b-2 text-[13px] font-semibold transition-all duration-200 active:scale-[0.98]",
      active ? "border-[#2563EB] text-[#1E40AF]" : "border-transparent text-[#64748B] hover:text-[#334155]"
    ),
    children: /* @__PURE__ */ jsxDEV("span", { children: label }, void 0, false, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 52,
      columnNumber: 5
    }, this)
  },
  void 0,
  false,
  {
    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
    lineNumber: 43,
    columnNumber: 1
  },
  this
);
_c2 = TabButton;
const SummaryCard = ({ label, value, icon: Icon, bgTint, textColor }) => /* @__PURE__ */ jsxDEV("div", { className: "flex-1 bg-white p-2 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between transition-all hover:shadow-md group", children: [
  /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col", children: [
    /* @__PURE__ */ jsxDEV("span", { className: "text-[#64748B] text-[9px] font-semibold uppercase tracking-wider mb-0.5", children: label }, void 0, false, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 59,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("span", { className: clsx("text-lg font-semibold leading-tight text-slate-900", textColor), children: value }, void 0, false, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 60,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
    lineNumber: 58,
    columnNumber: 5
  }, this),
  /* @__PURE__ */ jsxDEV("div", { className: clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-110", bgTint, textColor), children: /* @__PURE__ */ jsxDEV(Icon, { size: 16 }, void 0, false, {
    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
    lineNumber: 63,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
    lineNumber: 62,
    columnNumber: 5
  }, this)
] }, void 0, true, {
  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
  lineNumber: 57,
  columnNumber: 1
}, this);
_c3 = SummaryCard;
const PolicyInsightCard = ({ policy }) => /* @__PURE__ */ jsxDEV(
  "div",
  {
    className: clsx(
      "rounded-xl border p-1.5 shadow-sm transition-all hover:shadow-md w-[380px] h-[110px] overflow-hidden",
      policy?.isEffective ? "border-[#BFDBFE] bg-[#F8FBFF]" : "border-[#E2E8F0] bg-white"
    ),
    children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-1", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsxDEV("h4", { className: "text-[10px] font-semibold text-[#334155] truncate max-w-[100px]", children: policy?.name || "Leave Policy" }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 77,
            columnNumber: 9
          }, this),
          policy?.isEffective && /* @__PURE__ */ jsxDEV("span", { className: "bg-[#DBEAFE] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[#1D4ED8] rounded", children: "Active" }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 79,
            columnNumber: 7
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 76,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-medium uppercase text-[#64748B]", children: [
          "Scope: ",
          policy?.applicableTo || "All"
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 82,
          columnNumber: 7
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 75,
        columnNumber: 5
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "mt-1 grid grid-cols-3 gap-1", children: (policy?.rules || []).map((rule, index) => {
        const total = Number(rule?.totalPerYear || 0);
        const available = rule?.balance?.available;
        const progressValue = rule?.balance ? Math.min(100, (available || 0) / (total || 1) * 100) : 100;
        return /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-1 bg-white/80 p-0.5 rounded border border-slate-100", children: [
          /* @__PURE__ */ jsxDEV(
            "span",
            {
              className: "h-1.5 w-1.5 shrink-0 rounded-full",
              style: { backgroundColor: rule?.color || "#2563EB" }
            },
            void 0,
            false,
            {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 94,
              columnNumber: 13
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("span", { className: "truncate text-[9px] font-semibold text-[#334155] w-8", children: rule?.leaveType || "Leave" }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 98,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex-1 h-1 overflow-hidden rounded-full bg-slate-100 mx-1", children: /* @__PURE__ */ jsxDEV(
            "div",
            {
              className: "h-full rounded-full transition-all duration-700",
              style: { width: `${progressValue}%`, backgroundColor: rule?.color || "#2563EB" }
            },
            void 0,
            false,
            {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 100,
              columnNumber: 15
            },
            this
          ) }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 99,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-bold text-[#2563EB] whitespace-nowrap", children: rule?.balance ? `${available || 0}/${total}` : `${total}y` }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 105,
            columnNumber: 13
          }, this)
        ] }, `${policy?._id || policy?.name}-${rule?.leaveType || index}`, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 93,
          columnNumber: 9
        }, this);
      }) }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 86,
        columnNumber: 5
      }, this)
    ]
  },
  void 0,
  true,
  {
    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
    lineNumber: 69,
    columnNumber: 1
  },
  this
);
_c4 = PolicyInsightCard;
export default function AttendanceModule({
  profile,
  stats,
  isCheckedIn,
  isCheckedOut,
  todayRecord,
  balances,
  leaves,
  hasLeavePolicy,
  leavePolicies = [],
  effectivePolicyId = null,
  fetchDashboardData,
  handleCancelLeave,
  editLeave,
  setEditLeave,
  lastMonthAccrual = null,
  leavePolicy = null
}) {
  _s();
  const { hasPermission, loading: permissionLoading } = useRBAC();
  const canOpenAttendance = hasPermission("employee.attendance", "any");
  const canViewAttendance = hasPermission("employee.attendance", "view");
  const canCreateAttendance = hasPermission("employee.attendance", "create");
  const canEditAttendance = hasPermission("employee.attendance", "edit");
  const canDeleteAttendance = hasPermission("employee.attendance", "delete");
  const canApplyLeave = canCreateAttendance || canViewAttendance;
  const canSeeLeaveHistory = canViewAttendance || canEditAttendance || canDeleteAttendance;
  const canSeeRequestHistory = canViewAttendance || canEditAttendance || canDeleteAttendance;
  const onboardingPending = useMemo(() => isEmployeePendingActivation(profile), [profile]);
  const effectiveLeavePolicy = useMemo(() => {
    const policies = Array.isArray(leavePolicies) ? leavePolicies : [];
    return policies.find((policy) => policy?.isEffective || String(policy?._id || "") === String(effectivePolicyId || "")) || policies[0] || profile?.leavePolicy || null;
  }, [effectivePolicyId, leavePolicies, profile?.leavePolicy]);
  const location = useLocation();
  const navigate = useNavigate();
  const availableTabs = useMemo(() => [
    canViewAttendance ? "attendance" : null,
    canApplyLeave || canSeeLeaveHistory ? "leaves" : null,
    canCreateAttendance || canSeeRequestHistory ? "requests" : null
  ].filter(Boolean), [canViewAttendance, canCreateAttendance, canApplyLeave, canSeeLeaveHistory, canSeeRequestHistory]);
  const [activeTab, setActiveTab] = useState(availableTabs[0] || "attendance");
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (tabParam && availableTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (!tabParam && availableTabs.length > 0) {
      setActiveTab(availableTabs[0]);
    }
  }, [location.search, availableTabs]);
  const [earlyReturnModal, setEarlyReturnModal] = useState({ isOpen: false, leaveId: null, leaveData: null, newEndDate: "" });
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [isEarlyReturning, setIsEarlyReturning] = useState(false);
  const [leavesSubTab, setLeavesSubTab] = useState("apply");
  const [encashConfig, setEncashConfig] = useState(null);
  const [basicSalary, setBasicSalary] = useState(0);
  const [encashRequests, setEncashRequests] = useState([]);
  const [encashLoading, setEncashLoading] = useState(false);
  const [encashForm, setEncashForm] = useState({ days: "", reason: "" });
  const [encashSubmitting, setEncashSubmitting] = useState(false);
  const [encashCancelling, setEncashCancelling] = useState(null);
  useEffect(() => {
    if (activeTab !== "leaves") return;
    const fetchConfig = async () => {
      try {
        const cfgRes = await api.get("/employee/leaves/encashment/config");
        setEncashConfig(cfgRes.data?.config || null);
        if (cfgRes.data?.basicSalary) {
          setBasicSalary(cfgRes.data.basicSalary);
        }
      } catch (e) {
        console.error("[encashment] fetch config error:", e);
      }
    };
    fetchConfig();
  }, [activeTab]);
  useEffect(() => {
    if (activeTab !== "leaves" || leavesSubTab !== "encashment") return;
    const fetchRequests = async () => {
      setEncashLoading(true);
      try {
        const reqRes = await api.get("/employee/leaves/encashment/requests");
        setEncashRequests(reqRes.data?.requests || []);
      } catch (e) {
        console.error("[encashment] fetch requests error:", e);
      } finally {
        setEncashLoading(false);
      }
    };
    fetchRequests();
  }, [activeTab, leavesSubTab]);
  const handleEncashSubmit = async (e) => {
    e.preventDefault();
    setEncashSubmitting(true);
    try {
      await api.post("/employee/leaves/encashment/requests", {
        requestedDays: parseInt(encashForm.days),
        reason: encashForm.reason
      });
      setEncashForm({ days: "", reason: "" });
      const reqRes = await api.get("/employee/leaves/encashment/requests");
      setEncashRequests(reqRes.data?.requests || []);
      alert("Encashment request submitted successfully! HR will review it.");
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to submit encashment request.");
    } finally {
      setEncashSubmitting(false);
    }
  };
  const handleEncashCancel = async (requestId) => {
    setEncashCancelling(requestId);
    try {
      await api.post(`/employee/leaves/encashment/requests/${requestId}/cancel`);
      const reqRes = await api.get("/employee/leaves/encashment/requests");
      setEncashRequests(reqRes.data?.requests || []);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to cancel request.");
    } finally {
      setEncashCancelling(null);
    }
  };
  const handleEarlyReturnSubmit = async () => {
    if (!earlyReturnModal.newEndDate) return;
    try {
      setIsEarlyReturning(true);
      await api.post(`/employee/leaves/early-return/${earlyReturnModal.leaveId}`, { newEndDate: earlyReturnModal.newEndDate });
      setEarlyReturnModal({ isOpen: false, leaveId: null, leaveData: null, newEndDate: "" });
      fetchDashboardData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Failed to process early return");
    } finally {
      setIsEarlyReturning(false);
    }
  };
  const [currentMonth, setCurrentMonth] = useState((/* @__PURE__ */ new Date()).getMonth());
  const [currentYear, setCurrentYear] = useState((/* @__PURE__ */ new Date()).getFullYear());
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [settings, setSettings] = useState({});
  const [_loadingAttendance, setLoadingAttendance] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestForm, setRequestForm] = useState({
    startDate: "",
    endDate: "",
    checkIn: "",
    checkOut: "",
    reason: ""
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  useEffect(() => {
    if (permissionLoading || !canOpenAttendance || onboardingPending) return;
    if (activeTab === "attendance") {
      fetchMonthlyData();
    } else if (activeTab === "requests") {
      fetchRequestHistory();
    }
  }, [activeTab, currentMonth, currentYear, canOpenAttendance, canViewAttendance, canSeeRequestHistory, permissionLoading, onboardingPending]);
  useEffect(() => {
    if (!availableTabs.length) return;
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [activeTab, availableTabs]);
  const fetchMonthlyData = async () => {
    if (!canViewAttendance) return;
    try {
      setLoadingAttendance(true);
      const [attRes, holidayRes, settingsRes] = await Promise.all(
        [
          api.get(`/attendance/my?month=${currentMonth + 1}&year=${currentYear}`),
          api.get("/holidays"),
          api.get("/attendance/settings")
        ]
      );
      setMonthlyAttendance(attRes.data || []);
      setHolidays(holidayRes.data || []);
      setSettings(settingsRes.data || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAttendance(false);
    }
  };
  const fetchRequestHistory = async () => {
    if (!canSeeRequestHistory) return;
    try {
      const res = await api.get("/employee/regularization/my");
      setRequests(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!canCreateAttendance) return;
    if (!requestForm.startDate || !requestForm.reason) return;
    try {
      setSubmittingRequest(true);
      const payload = {
        category: "Attendance",
        startDate: requestForm.startDate,
        endDate: requestForm.endDate || requestForm.startDate,
        issueType: "Regularization",
        reason: requestForm.reason,
        requestedData: {
          checkIn: requestForm.checkIn ? `${requestForm.startDate}T${requestForm.checkIn}:00` : null,
          checkOut: requestForm.checkIn ? `${requestForm.startDate}T${requestForm.checkIn}:00` : null,
          punchIn: requestForm.checkIn ? `${requestForm.startDate}T${requestForm.checkIn}:00` : null,
          punchOut: requestForm.checkOut ? `${requestForm.startDate}T${requestForm.checkOut}:00` : null
        }
      };
      await api.post("/employee/regularization", payload);
      alert("Correction request submitted successful.");
      setRequestForm({ startDate: "", endDate: "", checkIn: "", checkOut: "", reason: "" });
      fetchRequestHistory();
    } catch (err) {
      alert(err.response?.data?.error || "Submission failed");
    } finally {
      setSubmittingRequest(false);
    }
  };
  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || "pending";
    const base = "inline-flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 ";
    if (s === "approved") return /* @__PURE__ */ jsxDEV("span", { className: base + "text-[#16A34A]", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "w-1.5 h-1.5 rounded-full bg-[#16A34A]" }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 372,
        columnNumber: 9
      }, this),
      "Approved"
    ] }, void 0, true, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 371,
      columnNumber: 7
    }, this);
    if (s === "rejected" || s === "cancelled") return /* @__PURE__ */ jsxDEV("span", { className: base + "text-[#DC2626]", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "w-1.5 h-1.5 rounded-full bg-[#DC2626]" }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 378,
        columnNumber: 9
      }, this),
      s === "rejected" ? "Rejected" : "Cancelled"
    ] }, void 0, true, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 377,
      columnNumber: 7
    }, this);
    return /* @__PURE__ */ jsxDEV("span", { className: base + "text-[#F59E0B]", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 384,
        columnNumber: 9
      }, this),
      "Pending"
    ] }, void 0, true, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 383,
      columnNumber: 7
    }, this);
  };
  if (permissionLoading) {
    return null;
  }
  if (!canOpenAttendance) {
    return /* @__PURE__ */ jsxDEV("div", { className: "flex min-h-[320px] items-center justify-center bg-white p-6", children: /* @__PURE__ */ jsxDEV("div", { className: "w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]", children: /* @__PURE__ */ jsxDEV(AlertCircle, { size: 28 }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 399,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 398,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("h3", { className: "text-[20px] font-semibold text-slate-900", children: "Attendance Access Restricted" }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 401,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "mt-2 text-xs font-medium text-[#64748B]", children: "You do not currently have permission to open attendance data for this workspace." }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 402,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 397,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 396,
      columnNumber: 7
    }, this);
  }
  if (onboardingPending) {
    return /* @__PURE__ */ jsxDEV("div", { className: "flex min-h-[320px] items-center justify-center bg-white p-6", children: /* @__PURE__ */ jsxDEV("div", { className: "w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]", children: /* @__PURE__ */ jsxDEV(ShieldCheck, { size: 28 }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 415,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 414,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("h3", { className: "text-[20px] font-semibold text-slate-900", children: "Finish Onboarding First" }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 417,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "mt-2 text-xs font-medium text-[#64748B]", children: "Attendance, leave history, and regularization will unlock after HR completes your account activation." }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 418,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 413,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 412,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV("div", { className: "h-full min-h-0 w-full bg-white font-inter flex flex-col", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "w-full flex min-h-0 flex-1 flex-col", children: [
      createPortal(
        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-row items-center justify-start ml-2", children: /* @__PURE__ */ jsxDEV("div", { className: "flex", children: [
          canViewAttendance && /* @__PURE__ */ jsxDEV(
            TabButton,
            {
              active: activeTab === "attendance",
              label: "Attendance",
              onClick: () => navigate("/employee/attendance?tab=attendance")
            },
            void 0,
            false,
            {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 435,
              columnNumber: 15
            },
            this
          ),
          (canApplyLeave || canSeeLeaveHistory) && /* @__PURE__ */ jsxDEV(
            TabButton,
            {
              active: activeTab === "leaves",
              label: "Leaves",
              onClick: () => navigate("/employee/attendance?tab=leaves")
            },
            void 0,
            false,
            {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 442,
              columnNumber: 15
            },
            this
          ),
          (canCreateAttendance || canSeeRequestHistory) && /* @__PURE__ */ jsxDEV(
            TabButton,
            {
              active: activeTab === "requests",
              label: "Requests",
              onClick: () => navigate("/employee/attendance?tab=requests")
            },
            void 0,
            false,
            {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 449,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 433,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 432,
          columnNumber: 11
        }, this),
        document.getElementById("hr-header-portal-target") || document.body
      ),
      /* @__PURE__ */ jsxDEV("div", { className: "min-h-0 flex-1 overflow-y-auto scroll-smooth transition-all duration-300 [scrollbar-gutter:stable] p-4", children: [
        activeTab === "attendance" && /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "sticky top-[-16px] z-20 -mx-4 px-4 pt-1 pb-4 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm mb-4", children: /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [
            /* @__PURE__ */ jsxDEV(SummaryCard, { label: "Present Days", value: stats.presentDays, icon: CheckCircle, bgTint: "bg-[#ECFDF5]", textColor: "text-[#16A34A]" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 468,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(SummaryCard, { label: "Absent Days", value: stats.absentDayCount || 0, icon: AlertCircle, bgTint: "bg-[#FEF2F2]", textColor: "text-[#DC2626]" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 469,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(SummaryCard, { label: "Leaves Taken", value: stats.leavesTaken, icon: Plane, bgTint: "bg-[#EFF6FF]", textColor: "text-[#2563EB]" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 470,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 467,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 466,
            columnNumber: 15
          }, this),
          settings?.effectiveShift && /* @__PURE__ */ jsxDEV("div", { className: "bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100/50 shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-blue-600", children: /* @__PURE__ */ jsxDEV(Clock, { size: 20 }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 479,
                columnNumber: 23
              }, this) }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 478,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("h3", { className: "text-sm font-bold text-slate-800", children: settings.effectiveShift.name }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 482,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-medium text-slate-500", children: "Your currently assigned shift schedule" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 483,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 481,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 477,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "bg-white px-4 py-2 rounded-lg border border-slate-100 shadow-sm", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 rounded-full bg-emerald-500 animate-pulse" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 488,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-bold text-slate-700", children: [
                settings.effectiveShift.startTime,
                " to ",
                settings.effectiveShift.endTime
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 489,
                columnNumber: 23
              }, this),
              settings.effectiveShift.isNightShift && /* @__PURE__ */ jsxDEV("span", { className: "ml-2 text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-wider", children: "Night Shift" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 493,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 487,
              columnNumber: 21
            }, this) }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 486,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 476,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV(
            ClientMeetingTracker,
            {
              isCheckedIn,
              isCheckedOut,
              todayRecord,
              fetchDashboardData
            },
            void 0,
            false,
            {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 500,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("div", { className: "bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden", children: /* @__PURE__ */ jsxDEV("div", { className: "px-4 pt-3 pb-4", children: /* @__PURE__ */ jsxDEV(
            AttendanceCalendar,
            {
              data: monthlyAttendance,
              holidays,
              leaves,
              settings,
              currentMonth,
              currentYear,
              headerControls: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-0.5 bg-slate-50 px-0.5 py-0.5 rounded-lg border border-[#E2E8F0]", children: [
                /* @__PURE__ */ jsxDEV("button", { onClick: () => setCurrentYear((y) => y - 1), className: "flex h-6 w-6 items-center justify-center hover:bg-white hover:text-[#2563EB] rounded transition-all text-[#64748B] active:scale-90", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center -space-x-2", children: [
                  /* @__PURE__ */ jsxDEV(ChevronLeft, { size: 12 }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 520,
                    columnNumber: 29
                  }, this),
                  /* @__PURE__ */ jsxDEV(ChevronLeft, { size: 12 }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 521,
                    columnNumber: 29
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 519,
                  columnNumber: 27
                }, this) }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 518,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("button", { onClick: () => {
                  if (currentMonth === 0) {
                    setCurrentMonth(11);
                    setCurrentYear((y) => y - 1);
                  } else setCurrentMonth((m) => m - 1);
                }, className: "flex h-6 w-6 items-center justify-center hover:bg-white hover:text-[#2563EB] rounded transition-all text-[#64748B] active:scale-90", children: /* @__PURE__ */ jsxDEV(ChevronLeft, { size: 13 }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 524,
                  columnNumber: 306
                }, this) }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 524,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-semibold text-[#334155] w-18 text-center uppercase tracking-wider", children: dayjs(new Date(currentYear, currentMonth)).format("MMM YYYY") }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 525,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("button", { onClick: () => {
                  if (currentMonth === 11) {
                    setCurrentMonth(0);
                    setCurrentYear((y) => y + 1);
                  } else setCurrentMonth((m) => m + 1);
                }, className: "flex h-6 w-6 items-center justify-center hover:bg-white hover:text-[#2563EB] rounded transition-all text-[#64748B] active:scale-90", children: /* @__PURE__ */ jsxDEV(ChevronRight, { size: 13 }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 526,
                  columnNumber: 306
                }, this) }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 526,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("button", { onClick: () => setCurrentYear((y) => y + 1), className: "flex h-6 w-6 items-center justify-center hover:bg-white hover:text-[#2563EB] rounded transition-all text-[#64748B] active:scale-90", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center -space-x-2", children: [
                  /* @__PURE__ */ jsxDEV(ChevronRight, { size: 12 }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 529,
                    columnNumber: 29
                  }, this),
                  /* @__PURE__ */ jsxDEV(ChevronRight, { size: 12 }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 530,
                    columnNumber: 29
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 528,
                  columnNumber: 27
                }, this) }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 527,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 517,
                columnNumber: 19
              }, this)
            },
            void 0,
            false,
            {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 509,
              columnNumber: 19
            },
            this
          ) }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 508,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 507,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 464,
          columnNumber: 11
        }, this),
        activeTab === "leaves" && /* @__PURE__ */ jsxDEV("div", { className: "space-y-6 animate-in slide-in-from-bottom-3 duration-500", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxDEV(SectionHeading, { title: "Leave Balances" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 546,
              columnNumber: 19
            }, this) }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 545,
              columnNumber: 17
            }, this),
            lastMonthAccrual && /* @__PURE__ */ jsxDEV("div", { className: "bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-pink-50/50 border border-indigo-100/60 rounded-2xl p-4 mb-6 shadow-sm", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4", children: [
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 mb-1.5", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "w-2 h-2 rounded-full bg-indigo-500 animate-pulse" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 554,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDEV("h4", { className: "text-xs font-black uppercase tracking-widest text-indigo-700", children: "Monthly Accrual Summary" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 555,
                      columnNumber: 27
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 553,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("p", { className: "text-[10px] text-slate-500 font-medium leading-normal", children: "Your leaves are credited monthly based on your attendance. Below is the details of last month's processing." }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 557,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 552,
                  columnNumber: 23
                }, this),
                leavePolicy && /* @__PURE__ */ jsxDEV("div", { className: "bg-white/80 border border-slate-100 px-3.5 py-2 rounded-xl", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-0.5", children: "Policy Formula" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 563,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-bold text-slate-700 font-mono", children: (() => {
                    const elRule = leavePolicy.rules?.find((r) => r.leaveType === "EL");
                    if (elRule && elRule.accrualDependsOnAttendance) {
                      const parts = [];
                      if (elRule.countPresent !== false) parts.push("P");
                      if (elRule.countOnDuty !== false) parts.push("OD");
                      if (elRule.countCompOff !== false) parts.push("CO");
                      if (elRule.countHoliday !== false) parts.push("PH");
                      if (elRule.countWeeklyOff !== false) parts.push("WO");
                      if (elRule.countPaidLeave) parts.push("PL");
                      return `(${parts.join(" + ")}) >= ${elRule.minAttendanceDays || 20}`;
                    }
                    return "(P + OD + CO + PH + WO) >= 20";
                  })() }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 564,
                    columnNumber: 27
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 562,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 551,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-3 border-t border-indigo-100/30", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "bg-white/50 p-2.5 rounded-xl border border-indigo-100/10", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-black uppercase tracking-widest text-slate-400 block", children: "Current Balance" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 586,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-black text-slate-800", children: [
                    (balances || []).find((b) => b.leaveType === "EL")?.available ?? 0,
                    " EL"
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 587,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 585,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "bg-white/50 p-2.5 rounded-xl border border-indigo-100/10", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-black uppercase tracking-widest text-slate-400 block", children: "Eligible Days (Last Month)" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 592,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-black text-slate-800", children: lastMonthAccrual.eligibleDays !== null ? `${lastMonthAccrual.eligibleDays} Days` : "N/A" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 593,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 591,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "bg-white/50 p-2.5 rounded-xl border border-indigo-100/10", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-black uppercase tracking-widest text-slate-400 block", children: "EL Credited" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 598,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-black text-slate-800", children: [
                    lastMonthAccrual.days || 0,
                    " EL"
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 599,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 597,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "bg-white/50 p-2.5 rounded-xl border border-indigo-100/10", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-black uppercase tracking-widest text-slate-400 block", children: "Status / Criteria" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 604,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: `text-xs font-black uppercase tracking-wider ${lastMonthAccrual.days > 0 ? "text-indigo-600" : "text-slate-500"}`, children: lastMonthAccrual.formulaApplied || "N/A" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 605,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 603,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 584,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 550,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4", children: balances.map((b, i) => {
              const typeLeaves = leaves.filter((l) => l.leaveType === b.leaveType);
              const used = typeLeaves.filter((l) => l.status?.toLowerCase() === "approved").reduce((acc, curr) => acc + (curr.daysCount || 0), 0);
              const pending = typeLeaves.filter((l) => l.status?.toLowerCase() === "pending").reduce((acc, curr) => acc + (curr.daysCount || 0), 0);
              const remaining = b.available || 0;
              const total = b.total || used + remaining;
              const colors = {
                text: "text-slate-600",
                bg: "bg-slate-50/50",
                border: "border-slate-100/50",
                accent: "bg-slate-400"
              };
              return /* @__PURE__ */ jsxDEV("div", { className: clsx("bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-all group relative overflow-hidden", colors.border), children: [
                /* @__PURE__ */ jsxDEV("div", { className: clsx("absolute top-0 left-0 w-1 h-full", colors.accent) }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 631,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-2", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-black uppercase tracking-widest text-slate-400", children: b.leaveType }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 634,
                    columnNumber: 27
                  }, this),
                  remaining === 0 ? /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-400", children: "Exhausted" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 636,
                    columnNumber: 25
                  }, this) : /* @__PURE__ */ jsxDEV("span", { className: clsx("text-[10px] font-bold px-2 py-0.5 rounded-md", colors.bg, colors.text), children: "Available" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 638,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 633,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-baseline gap-1.5 mb-4", children: [
                  /* @__PURE__ */ jsxDEV("span", { className: "text-2xl font-black text-slate-800 leading-none", children: remaining }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 643,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-bold text-slate-400", children: "Units" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 644,
                    columnNumber: 27
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 642,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap gap-2 pt-2 border-t border-slate-50", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-black text-slate-400 uppercase", children: "Tot" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 649,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-bold text-slate-700", children: total }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 650,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 648,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-1.5 bg-emerald-50/50 px-2 py-1 rounded-md", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-black text-emerald-400 uppercase", children: "Use" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 653,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-bold text-emerald-600", children: used }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 654,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 652,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-1.5 bg-amber-50/50 px-2 py-1 rounded-md", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-black text-amber-400 uppercase", children: "Wait" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 657,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: clsx("text-xs font-bold", pending > 0 ? "text-amber-500" : "text-slate-300"), children: pending }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 658,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 656,
                    columnNumber: 27
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 647,
                  columnNumber: 25
                }, this)
              ] }, b.leaveType || i, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 629,
                columnNumber: 21
              }, this);
            }) }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 613,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 544,
            columnNumber: 15
          }, this),
          encashConfig?.allowed && /* @__PURE__ */ jsxDEV("div", { className: "flex gap-2 mb-4", children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                onClick: () => setLeavesSubTab("apply"),
                className: clsx(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                  leavesSubTab === "apply" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
                ),
                children: [
                  /* @__PURE__ */ jsxDEV(Plane, { size: 12 }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 675,
                    columnNumber: 19
                  }, this),
                  " Apply Leave"
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 670,
                columnNumber: 17
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                onClick: () => setLeavesSubTab("encashment"),
                className: clsx(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                  leavesSubTab === "encashment" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
                ),
                children: [
                  /* @__PURE__ */ jsxDEV(DollarSign, { size: 12 }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 682,
                    columnNumber: 19
                  }, this),
                  " Leave Encashment"
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 677,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 669,
            columnNumber: 13
          }, this),
          leavesSubTab === "apply" && /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start", children: [
            canApplyLeave && /* @__PURE__ */ jsxDEV("div", { className: "lg:col-span-5", children: [
              /* @__PURE__ */ jsxDEV(SectionHeading, { title: "Apply for Leave" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 692,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                ApplyLeaveForm,
                {
                  balances,
                  existingLeaves: leaves,
                  editData: editLeave,
                  onSuccess: () => {
                    setEditLeave(null);
                    fetchDashboardData();
                  },
                  onCancelEdit: () => setEditLeave(null),
                  profile,
                  leavePolicy: effectiveLeavePolicy,
                  hasLeavePolicy
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 693,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 691,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: clsx("lg:col-span-7", !canApplyLeave && "lg:col-span-12"), children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-2", children: [
                /* @__PURE__ */ jsxDEV(SectionHeading, { title: "Leave Activity" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 709,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-medium text-[#64748B] bg-slate-100 px-3 py-1 rounded-full", children: [
                  leaves.length,
                  " Total"
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 710,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 708,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: !canSeeLeaveHistory ? /* @__PURE__ */ jsxDEV("div", { className: "bg-white border border-dashed border-[#E2E8F0] rounded-xl py-16 flex flex-col items-center justify-center text-center", children: [
                /* @__PURE__ */ jsxDEV(AlertCircle, { size: 28, className: "mb-1.5 text-slate-300" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 716,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-[11px] font-medium text-[#64748B] uppercase tracking-wider", children: "History hidden by access control" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 717,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 715,
                columnNumber: 19
              }, this) : leaves.length > 0 ? [...leaves].sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).map(
                (leave, i) => /* @__PURE__ */ jsxDEV("div", { onClick: () => setSelectedLeave(leave), className: "bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between gap-6 hover:shadow-md transition-all duration-300 cursor-pointer", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-4", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "w-12 h-12 bg-white border border-[#E2E8F0] rounded-lg flex flex-col items-center justify-center text-[#334155]", children: [
                      /* @__PURE__ */ jsxDEV("span", { className: "text-[9px] uppercase font-semibold text-[#64748B] opacity-60 leading-none mb-1", children: dayjs(leave.startDate).format("MMM") }, void 0, false, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 724,
                        columnNumber: 31
                      }, this),
                      /* @__PURE__ */ jsxDEV("span", { className: "text-[18px] font-semibold leading-none", children: dayjs(leave.startDate).format("DD") }, void 0, false, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 725,
                        columnNumber: 31
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 723,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 mb-0.5", children: [
                        /* @__PURE__ */ jsxDEV("h4", { className: "text-xs font-bold text-[#334155]", children: leave.leaveType }, void 0, false, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 729,
                          columnNumber: 33
                        }, this),
                        leave.isHalfDay && leave.halfDaySession && /* @__PURE__ */ jsxDEV("span", { className: "bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider", children: leave.halfDaySession }, void 0, false, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 731,
                          columnNumber: 27
                        }, this)
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 728,
                        columnNumber: 31
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 text-xs text-[#64748B]", children: [
                        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
                          /* @__PURE__ */ jsxDEV(CalendarIcon, { size: 12, className: "opacity-40" }, void 0, false, {
                            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                            lineNumber: 738,
                            columnNumber: 35
                          }, this),
                          formatDateDDMMYYYY(leave.startDate),
                          " ",
                          leave.endDate && leave.endDate !== leave.startDate ? `â ${formatDateDDMMYYYY(leave.endDate)}` : ""
                        ] }, void 0, true, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 737,
                          columnNumber: 33
                        }, this),
                        /* @__PURE__ */ jsxDEV("span", { className: "text-[#2563EB] font-semibold tracking-tight", children: [
                          leave.daysCount,
                          " ",
                          /* @__PURE__ */ jsxDEV("span", { className: "text-[8px] font-medium uppercase opacity-60 ml-0.5", children: leave.daysCount === 1 ? "Day" : "Days" }, void 0, false, {
                            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                            lineNumber: 742,
                            columnNumber: 53
                          }, this)
                        ] }, void 0, true, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 741,
                          columnNumber: 33
                        }, this)
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 736,
                        columnNumber: 31
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 727,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 722,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-6", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-end gap-1 px-2", children: [
                      getStatusBadge(leave.status),
                      (leave.approvedAt || leave.rejectedAt || leave.cancelledAt) && /* @__PURE__ */ jsxDEV("span", { className: "text-[9px] font-semibold text-slate-400 opacity-60 uppercase tracking-tighter mt-0.5", children: dayjs(leave.approvedAt || leave.rejectedAt || leave.cancelledAt).format("DD-MM-YYYY HH:mm") }, void 0, false, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 752,
                        columnNumber: 25
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 749,
                      columnNumber: 29
                    }, this),
                    canDeleteAttendance && leave.status?.toLowerCase() === "pending" && /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        onClick: (e) => {
                          e.stopPropagation();
                          handleCancelLeave?.(leave._id);
                        },
                        className: "w-9 h-9 flex items-center justify-center bg-[#FEF2F2] text-[#DC2626] rounded-lg hover:bg-[#DC2626] hover:text-white transition-all shadow-sm active:scale-95",
                        title: "Cancel Request",
                        children: /* @__PURE__ */ jsxDEV(XCircle, { size: 18 }, void 0, false, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 766,
                          columnNumber: 33
                        }, this)
                      },
                      void 0,
                      false,
                      {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 758,
                        columnNumber: 23
                      },
                      this
                    ),
                    canEditAttendance && leave.status === "Approved" && dayjs().isBefore(dayjs(leave.endDate).endOf("day")) && /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        onClick: (e) => {
                          e.stopPropagation();
                          setEarlyReturnModal({ isOpen: true, leaveId: leave._id, leaveData: leave, newEndDate: dayjs().format("YYYY-MM-DD") });
                        },
                        className: "w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95",
                        title: "Early Return / Partial Cancel",
                        children: /* @__PURE__ */ jsxDEV(History, { size: 16 }, void 0, false, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 778,
                          columnNumber: 34
                        }, this)
                      },
                      void 0,
                      false,
                      {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 770,
                        columnNumber: 23
                      },
                      this
                    )
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 748,
                    columnNumber: 27
                  }, this)
                ] }, i, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 721,
                  columnNumber: 19
                }, this)
              ) : /* @__PURE__ */ jsxDEV("div", { className: "bg-white border border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center py-20", children: /* @__PURE__ */ jsxDEV(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: /* @__PURE__ */ jsxDEV("span", { className: "text-[#64748B] text-xs font-medium", children: "No records found" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 786,
                columnNumber: 82
              }, this) }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 786,
                columnNumber: 25
              }, this) }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 785,
                columnNumber: 19
              }, this) }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 713,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 707,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 688,
            columnNumber: 13
          }, this),
          leavesSubTab === "encashment" && encashConfig?.allowed && /* @__PURE__ */ jsxDEV("div", { className: "space-y-6 animate-in slide-in-from-bottom-3 duration-300", children: encashLoading ? /* @__PURE__ */ jsxDEV("div", { className: "py-12 text-center text-slate-400 text-xs font-bold", children: "Loading..." }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 797,
            columnNumber: 15
          }, this) : /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "lg:col-span-5 space-y-4", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3", children: [
                /* @__PURE__ */ jsxDEV("h3", { className: "font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5", children: [
                  /* @__PURE__ */ jsxDEV(Info, { size: 14, className: "text-indigo-500" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 805,
                    columnNumber: 27
                  }, this),
                  " Encashment Policy details"
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 804,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-2 text-xs", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-slate-500", children: "Allowed Leave Type" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 809,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "font-black text-indigo-700", children: encashConfig.leaveType }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 810,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 808,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-slate-500", children: "Max Encashable Days/Year" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 813,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "font-black text-indigo-700", children: [
                      encashConfig.maxEncashableDays,
                      " Days"
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 814,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 812,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-slate-500", children: "Min Balance to Retain" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 817,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "font-black text-indigo-700", children: [
                      encashConfig.minBalanceRetain,
                      " Days"
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 818,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 816,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-slate-500", children: "Formula" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 821,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "font-black text-indigo-700", children: encashConfig.formula }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 822,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 820,
                    columnNumber: 27
                  }, this),
                  encashConfig.taxRule && /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between border-t border-indigo-100/50 pt-2 mt-2", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-slate-500", children: "Tax Rule" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 826,
                      columnNumber: 31
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "font-black text-slate-700", children: encashConfig.taxRule }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 827,
                      columnNumber: 31
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 825,
                    columnNumber: 23
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 807,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 803,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4", children: [
                /* @__PURE__ */ jsxDEV("h3", { className: "font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5", children: [
                  /* @__PURE__ */ jsxDEV(DollarSign, { size: 14, className: "text-indigo-500" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 836,
                    columnNumber: 27
                  }, this),
                  " Request Encashment"
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 835,
                  columnNumber: 25
                }, this),
                (() => {
                  const encashableBalance = balances.find((b) => b.leaveType === encashConfig.leaveType.toUpperCase());
                  const availableDays = encashableBalance ? encashableBalance.available || 0 : 0;
                  const daysNum = parseInt(encashForm.days) || 0;
                  const validationError = (() => {
                    if (daysNum <= 0) return null;
                    if (daysNum > (encashConfig?.maxEncashableDays || 0)) {
                      return `Maximum encashable days is ${encashConfig?.maxEncashableDays}.`;
                    }
                    if (availableDays - daysNum < (encashConfig?.minBalanceRetain || 0)) {
                      return `You must retain at least ${encashConfig?.minBalanceRetain} days of ${encashConfig?.leaveType} balance. (Current: ${availableDays}, Retained: ${availableDays - daysNum})`;
                    }
                    return null;
                  })();
                  const payoutAmount = daysNum > 0 && basicSalary > 0 ? Math.round(basicSalary / 30 * daysNum) : 0;
                  return /* @__PURE__ */ jsxDEV("form", { onSubmit: handleEncashSubmit, className: "space-y-4", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex items-center justify-between text-xs", children: [
                      /* @__PURE__ */ jsxDEV("span", { className: "text-slate-500", children: [
                        "Your ",
                        encashConfig.leaveType,
                        " Balance:"
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 862,
                        columnNumber: 33
                      }, this),
                      /* @__PURE__ */ jsxDEV("span", { className: "font-black text-emerald-600", children: [
                        availableDays,
                        " Days"
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 863,
                        columnNumber: 33
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 861,
                      columnNumber: 31
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "space-y-1", children: [
                      /* @__PURE__ */ jsxDEV("label", { className: "text-[10px] font-bold text-slate-500 uppercase tracking-wider", children: "Days to Encash *" }, void 0, false, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 867,
                        columnNumber: 33
                      }, this),
                      /* @__PURE__ */ jsxDEV(
                        "input",
                        {
                          type: "number",
                          min: "1",
                          max: encashConfig?.maxEncashableDays || 30,
                          value: encashForm.days,
                          onChange: (e) => setEncashForm((prev) => ({ ...prev, days: e.target.value })),
                          placeholder: `Max ${encashConfig?.maxEncashableDays || 0} days`,
                          className: "w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all",
                          required: true
                        },
                        void 0,
                        false,
                        {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 868,
                          columnNumber: 33
                        },
                        this
                      )
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 866,
                      columnNumber: 31
                    }, this),
                    daysNum > 0 && /* @__PURE__ */ jsxDEV("div", { className: "bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-200", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center", children: [
                        /* @__PURE__ */ jsxDEV("span", { className: "text-slate-500 text-xs", children: "Estimated Payout:" }, void 0, false, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 884,
                          columnNumber: 37
                        }, this),
                        /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-black text-emerald-700", children: [
                          "â¹",
                          payoutAmount.toLocaleString()
                        ] }, void 0, true, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 885,
                          columnNumber: 37
                        }, this)
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 883,
                        columnNumber: 35
                      }, this),
                      basicSalary > 0 && /* @__PURE__ */ jsxDEV("p", { className: "text-[10px] text-slate-400 font-medium leading-normal", children: [
                        "Calculation: â¹",
                        basicSalary.toLocaleString(),
                        " (Basic) Ã· 30 Ã ",
                        daysNum,
                        " Days = â¹",
                        payoutAmount.toLocaleString()
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 888,
                        columnNumber: 29
                      }, this),
                      /* @__PURE__ */ jsxDEV("p", { className: "text-[10px] text-slate-400 italic", children: "Exact payout will be verified and approved by HR." }, void 0, false, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 892,
                        columnNumber: 35
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 882,
                      columnNumber: 27
                    }, this),
                    validationError && /* @__PURE__ */ jsxDEV("div", { className: "bg-rose-50 border border-rose-100 rounded-xl p-3 text-[11px] font-semibold text-rose-600 flex items-start gap-2", children: [
                      /* @__PURE__ */ jsxDEV(AlertCircle, { size: 14, className: "mt-0.5 flex-shrink-0" }, void 0, false, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 898,
                        columnNumber: 35
                      }, this),
                      /* @__PURE__ */ jsxDEV("span", { children: validationError }, void 0, false, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 899,
                        columnNumber: 35
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 897,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "space-y-1", children: [
                      /* @__PURE__ */ jsxDEV("label", { className: "text-[10px] font-bold text-slate-500 uppercase tracking-wider", children: "Reason (Optional)" }, void 0, false, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 904,
                        columnNumber: 33
                      }, this),
                      /* @__PURE__ */ jsxDEV(
                        "textarea",
                        {
                          rows: 2,
                          value: encashForm.reason,
                          onChange: (e) => setEncashForm((prev) => ({ ...prev, reason: e.target.value })),
                          placeholder: "Provide a reason for encashment request...",
                          className: "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-500 transition-all resize-none"
                        },
                        void 0,
                        false,
                        {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 905,
                          columnNumber: 33
                        },
                        this
                      )
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 903,
                      columnNumber: 31
                    }, this),
                    /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        type: "submit",
                        disabled: encashSubmitting || !!validationError || daysNum <= 0,
                        className: "w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
                        children: encashSubmitting ? "Submitting..." : "Submit Encashment Request"
                      },
                      void 0,
                      false,
                      {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 914,
                        columnNumber: 31
                      },
                      this
                    )
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 860,
                    columnNumber: 25
                  }, this);
                })()
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 834,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 801,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "lg:col-span-7", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4", children: [
              /* @__PURE__ */ jsxDEV("h3", { className: "font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5", children: [
                /* @__PURE__ */ jsxDEV(History, { size: 14, className: "text-indigo-500" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 931,
                  columnNumber: 27
                }, this),
                " My Encashment Requests"
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 930,
                columnNumber: 25
              }, this),
              encashRequests.length === 0 ? /* @__PURE__ */ jsxDEV("div", { className: "py-16 flex flex-col items-center justify-center text-slate-400", children: [
                /* @__PURE__ */ jsxDEV("span", { className: "text-3xl mb-2", children: "ð°" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 935,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-400", children: "No encashment requests yet" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 936,
                  columnNumber: 29
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 934,
                columnNumber: 21
              }, this) : /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: encashRequests.map((req) => {
                const statusColor = {
                  Pending: "bg-amber-50 text-amber-600 border-amber-100",
                  Approved: "bg-emerald-50 text-emerald-600 border-emerald-100",
                  Rejected: "bg-rose-50 text-rose-600 border-rose-100",
                  Cancelled: "bg-slate-100 text-slate-500 border-slate-200"
                }[req.status] || "bg-slate-100 text-slate-500 border-slate-200";
                return /* @__PURE__ */ jsxDEV("div", { className: "border border-slate-100 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-slate-200 transition-all", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5 flex-1 min-w-0", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 flex-wrap", children: [
                      /* @__PURE__ */ jsxDEV("span", { className: "font-extrabold text-slate-800 text-xs", children: [
                        req.requestedDays,
                        " Days (",
                        req.leaveType,
                        ")"
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 951,
                        columnNumber: 39
                      }, this),
                      /* @__PURE__ */ jsxDEV("span", { className: clsx("px-2 py-0.5 rounded text-[9px] font-black uppercase border", statusColor), children: req.status }, void 0, false, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 952,
                        columnNumber: 39
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 950,
                      columnNumber: 37
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500", children: [
                      /* @__PURE__ */ jsxDEV("div", { children: [
                        "Available: ",
                        /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-slate-700", children: [
                          req.availableBalance,
                          " Days"
                        ] }, void 0, true, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 957,
                          columnNumber: 55
                        }, this)
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 957,
                        columnNumber: 39
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { children: [
                        "Payout: ",
                        /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-emerald-600", children: [
                          "â¹",
                          (req.payoutAmount || 0).toLocaleString()
                        ] }, void 0, true, {
                          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                          lineNumber: 958,
                          columnNumber: 52
                        }, this)
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 958,
                        columnNumber: 39
                      }, this),
                      req.reason && /* @__PURE__ */ jsxDEV("div", { className: "col-span-2 text-slate-400 italic truncate mt-0.5", children: [
                        'Reason: "',
                        req.reason,
                        '"'
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 959,
                        columnNumber: 54
                      }, this),
                      req.adminRemark && /* @__PURE__ */ jsxDEV("div", { className: "col-span-2 text-indigo-600 font-semibold mt-0.5", children: [
                        'HR Remark: "',
                        req.adminRemark,
                        '"'
                      ] }, void 0, true, {
                        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                        lineNumber: 960,
                        columnNumber: 59
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 956,
                      columnNumber: 37
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "text-[10px] text-slate-400 font-medium", children: [
                      "Requested on: ",
                      dayjs(req.createdAt).format("DD-MM-YYYY HH:mm")
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 962,
                      columnNumber: 37
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 949,
                    columnNumber: 35
                  }, this),
                  req.status === "Pending" && /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: () => handleEncashCancel(req._id),
                      disabled: encashCancelling === req._id,
                      className: "px-3 py-1.5 border border-rose-200 hover:bg-rose-50 rounded-lg text-[10px] font-black text-rose-500 uppercase tracking-wider transition-all disabled:opacity-50",
                      children: encashCancelling === req._id ? "..." : "Cancel"
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 967,
                      columnNumber: 29
                    },
                    this
                  )
                ] }, req._id, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 948,
                  columnNumber: 27
                }, this);
              }) }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 939,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 929,
              columnNumber: 23
            }, this) }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 928,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 799,
            columnNumber: 15
          }, this) }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 795,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 543,
          columnNumber: 11
        }, this),
        activeTab === "requests" && /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in slide-in-from-bottom-3 duration-500", children: [
          canCreateAttendance && /* @__PURE__ */ jsxDEV("div", { className: "lg:col-span-5", children: [
            /* @__PURE__ */ jsxDEV(SectionHeading, { title: "Regularization" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 994,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm", children: /* @__PURE__ */ jsxDEV("form", { onSubmit: handleRequestSubmit, className: "space-y-4", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-2 gap-4", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxDEV("label", { className: "text-xs font-medium text-[#64748B]", children: "Target Date *" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 999,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    "input",
                    {
                      type: "date",
                      required: true,
                      max: dayjs().format("YYYY-MM-DD"),
                      className: "w-full h-[40px] bg-white border border-[#E2E8F0] rounded-lg px-4 text-xs font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all",
                      value: requestForm.startDate,
                      onChange: (e) => setRequestForm({ ...requestForm, startDate: e.target.value })
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 1e3,
                      columnNumber: 27
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 998,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxDEV("label", { className: "text-xs font-medium text-[#64748B]", children: "Category" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1010,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "h-[40px] flex items-center px-4 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#64748B] tracking-wide uppercase opacity-60", children: "Attendance Log" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1011,
                    columnNumber: 27
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1009,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 997,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-2 gap-4", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxDEV("label", { className: "text-xs font-medium text-[#64748B]", children: "Punch In" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1017,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    "input",
                    {
                      type: "time",
                      className: "w-full h-[40px] bg-white border border-[#E2E8F0] rounded-lg px-4 text-xs font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all",
                      value: requestForm.checkIn,
                      onChange: (e) => setRequestForm({ ...requestForm, checkIn: e.target.value })
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 1018,
                      columnNumber: 27
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1016,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5", children: [
                  /* @__PURE__ */ jsxDEV("label", { className: "text-xs font-medium text-[#64748B]", children: "Punch Out" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1026,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    "input",
                    {
                      type: "time",
                      className: "w-full h-[40px] bg-white border border-[#E2E8F0] rounded-lg px-4 text-xs font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all",
                      value: requestForm.checkOut,
                      onChange: (e) => setRequestForm({ ...requestForm, checkOut: e.target.value })
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 1027,
                      columnNumber: 27
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1025,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1015,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5", children: [
                /* @__PURE__ */ jsxDEV("label", { className: "text-xs font-medium text-[#64748B]", children: "Justification Reason *" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1037,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "textarea",
                  {
                    required: true,
                    placeholder: "Why is this correction needed?...",
                    className: "w-full bg-slate-50 border border-[#E2E8F0] rounded-lg p-4 text-xs font-medium text-[#334155] outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2563EB] transition-all min-h-[120px] resize-none",
                    value: requestForm.reason,
                    onChange: (e) => setRequestForm({ ...requestForm, reason: e.target.value })
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1038,
                    columnNumber: 25
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1036,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "pt-2", children: /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "submit",
                  disabled: submittingRequest,
                  className: "w-full h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 shadow-sm shadow-blue-500/10",
                  children: submittingRequest ? /* @__PURE__ */ jsxDEV("div", { className: "w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1054,
                    columnNumber: 23
                  }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
                    /* @__PURE__ */ jsxDEV(Send, { size: 16 }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 1057,
                      columnNumber: 31
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { children: "Submit Adjustment" }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 1058,
                      columnNumber: 31
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1056,
                    columnNumber: 23
                  }, this)
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1048,
                  columnNumber: 25
                },
                this
              ) }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1047,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 996,
              columnNumber: 21
            }, this) }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 995,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 993,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: clsx("lg:col-span-7", !canCreateAttendance && "lg:col-span-12"), children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-2", children: [
              /* @__PURE__ */ jsxDEV(SectionHeading, { title: "Adjustment Log" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1071,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-medium text-[#64748B] bg-slate-100 px-3 py-1 rounded-full", children: [
                requests.length,
                " Total"
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1072,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1070,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-3", children: !canSeeRequestHistory ? /* @__PURE__ */ jsxDEV("div", { className: "bg-white p-12 rounded-xl border border-dashed border-[#E2E8F0] flex flex-col items-center justify-center opacity-60", children: [
              /* @__PURE__ */ jsxDEV(History, { size: 32, className: "mb-2 text-slate-300" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1078,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-medium uppercase", children: "History hidden by access control" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1079,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1077,
              columnNumber: 17
            }, this) : requests.length > 0 ? requests.map(
              (req, i) => /* @__PURE__ */ jsxDEV("div", { className: "bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between transition-all duration-200 hover:shadow-md", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-4", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "w-12 h-12 bg-slate-50 border border-[#E2E8F0] rounded-lg flex flex-col items-center justify-center text-[#334155]", children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-[9px] uppercase font-semibold text-[#64748B] opacity-60 leading-none mb-1", children: dayjs(req.startDate).format("MMM") }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 1086,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "text-[18px] font-semibold leading-none", children: dayjs(req.startDate).format("DD") }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 1087,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1085,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { children: [
                    /* @__PURE__ */ jsxDEV("h4", { className: "text-xs font-bold text-[#334155] mb-0.5", children: formatDateDDMMYYYY(req.startDate) }, void 0, false, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 1090,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-[#64748B] font-medium line-clamp-1 max-w-[240px]", children: [
                      '"',
                      req.reason,
                      '"'
                    ] }, void 0, true, {
                      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                      lineNumber: 1091,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1089,
                    columnNumber: 27
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1084,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "shrink-0", children: getStatusBadge(req.status) }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1094,
                  columnNumber: 25
                }, this)
              ] }, i, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1083,
                columnNumber: 17
              }, this)
            ) : /* @__PURE__ */ jsxDEV("div", { className: "bg-white p-12 rounded-xl border border-dashed border-[#E2E8F0] flex flex-col items-center justify-center opacity-40", children: [
              /* @__PURE__ */ jsxDEV(History, { size: 32, className: "mb-2 text-slate-300" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1101,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-medium uppercase", children: "No history" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1102,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1100,
              columnNumber: 17
            }, this) }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1075,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1069,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 990,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 460,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 428,
      columnNumber: 7
    }, this),
    earlyReturnModal.isOpen && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "px-6 py-4 border-b border-slate-100 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-bold text-slate-800 tracking-tight", children: "Early Return / Cancel Leave" }, void 0, false, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 1117,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("button", { onClick: () => setEarlyReturnModal({ isOpen: false, leaveId: null, leaveData: null, newEndDate: "" }), className: "p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all", children: /* @__PURE__ */ jsxDEV(XCircle, { size: 20 }, void 0, false, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 1119,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 1118,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 1116,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "p-6 space-y-5", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3", children: [
          /* @__PURE__ */ jsxDEV(Info, { size: 18, className: "text-amber-500 mt-0.5 shrink-0" }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1124,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-medium text-amber-700 leading-relaxed", children: [
            "If you have returned to work earlier than expected, select your new End Date below. Your unused leave balance will be automatically refunded, and your attendance records will be cleared.",
            /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1127,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1127,
              columnNumber: 25
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "font-bold", children: "Note: To fully cancel this leave and refund all days, click the 'Full Cancel' button below." }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1128,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1125,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 1123,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsxDEV("label", { className: "text-xs font-bold text-slate-600 uppercase tracking-widest", children: "New End Date" }, void 0, false, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1132,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            "input",
            {
              type: "date",
              min: dayjs(earlyReturnModal.leaveData.startDate).format("YYYY-MM-DD"),
              max: dayjs(earlyReturnModal.leaveData.endDate).format("YYYY-MM-DD"),
              className: "w-full h-[42px] px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all",
              value: earlyReturnModal.newEndDate,
              onChange: (e) => setEarlyReturnModal({ ...earlyReturnModal, newEndDate: e.target.value })
            },
            void 0,
            false,
            {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1133,
              columnNumber: 17
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 1131,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 1122,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end items-center", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: async () => {
              try {
                setIsEarlyReturning(true);
                const fullCancelDate = dayjs(earlyReturnModal.leaveData.startDate).subtract(1, "day").format("YYYY-MM-DD");
                await api.post(`/employee/leaves/early-return/${earlyReturnModal.leaveId}`, { newEndDate: fullCancelDate });
                setEarlyReturnModal({ isOpen: false, leaveId: null, leaveData: null, newEndDate: "" });
                fetchDashboardData();
              } catch {
                alert("Failed to fully cancel leave");
              } finally {
                setIsEarlyReturning(false);
              }
            },
            disabled: isEarlyReturning,
            className: "px-5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all mr-auto",
            children: "Full Cancel"
          },
          void 0,
          false,
          {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1144,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV("button", { onClick: () => setEarlyReturnModal({ isOpen: false, leaveId: null, leaveData: null, newEndDate: "" }), className: "px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all", children: "Cancel" }, void 0, false, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 1163,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: handleEarlyReturnSubmit,
            disabled: isEarlyReturning || !earlyReturnModal.newEndDate,
            className: "px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95",
            children: [
              isEarlyReturning ? /* @__PURE__ */ jsxDEV("div", { className: "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1169,
                columnNumber: 37
              }, this) : /* @__PURE__ */ jsxDEV(CheckCircle, { size: 14 }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1169,
                columnNumber: 133
              }, this),
              "Confirm Return"
            ]
          },
          void 0,
          true,
          {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1164,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 1143,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 1115,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
      lineNumber: 1114,
      columnNumber: 7
    }, this),
    selectedLeave && createPortal(
      /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0 font-inter", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("h2", { className: "text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5", children: [
              /* @__PURE__ */ jsxDEV(FileText, { size: 16, className: "text-indigo-650" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1185,
                columnNumber: 19
              }, this),
              "Leave Request Details"
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1184,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("p", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5", children: [
              "REQ-",
              selectedLeave._id?.slice(-6).toUpperCase()
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1188,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1183,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => setSelectedLeave(null),
              className: "w-9 h-9 flex items-center justify-center rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all active:scale-95 animate-in fade-in",
              children: /* @__PURE__ */ jsxDEV(XCircle, { size: 18 }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1196,
                columnNumber: 17
              }, this)
            },
            void 0,
            false,
            {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1192,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 1182,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto p-6 space-y-5 font-inter text-xs", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1", children: "Leave Category" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1205,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black rounded", children: selectedLeave.leaveType }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1206,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1204,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1", children: "Current Status" }, void 0, false, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1209,
                columnNumber: 19
              }, this),
              getStatusBadge(selectedLeave.status, selectedLeave.meta)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1208,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1203,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider block", children: "Duration Details" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1216,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "bg-white border border-slate-150 rounded-xl p-4 flex items-center justify-between gap-4", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "w-10 h-10 rounded-lg bg-indigo-50/50 flex items-center justify-center text-indigo-600", children: /* @__PURE__ */ jsxDEV(CalendarIcon, { size: 18 }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1220,
                  columnNumber: 23
                }, this) }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1219,
                  columnNumber: 21
                }, this),
                /* @__PURE__ */ jsxDEV("div", { children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "text-xs font-bold text-slate-800", children: [
                    formatDateDDMMYYYY(selectedLeave.startDate),
                    " ",
                    selectedLeave.endDate && selectedLeave.endDate !== selectedLeave.startDate ? `â ${formatDateDDMMYYYY(selectedLeave.endDate)}` : ""
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1223,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "text-[10px] text-slate-400 font-medium mt-0.5", children: [
                    "Applied on ",
                    selectedLeave.createdAt ? dayjs(selectedLeave.createdAt).format("DD-MM-YYYY HH:mm") : "N/A"
                  ] }, void 0, true, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1226,
                    columnNumber: 23
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1222,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1218,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "text-right", children: [
                /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-extrabold text-[#2563EB]", children: [
                  selectedLeave.daysCount,
                  " ",
                  selectedLeave.daysCount === 1 ? "Day" : "Days"
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1232,
                  columnNumber: 21
                }, this),
                selectedLeave.isHalfDay && /* @__PURE__ */ jsxDEV("span", { className: "block text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1 py-0.5 rounded mt-1 uppercase tracking-wider", children: (() => {
                  const custom = selectedLeave.meta?.customHalfDays;
                  if (custom && selectedLeave.startDate !== selectedLeave.endDate) {
                    if (custom.firstDayHalf && custom.lastDayHalf) return "Half (Both Days)";
                    if (custom.firstDayHalf) return `Half (First: ${custom.firstDaySession.split(" ")[0]})`;
                    if (custom.lastDayHalf) return `Half (Last: ${custom.lastDaySession.split(" ")[0]})`;
                  }
                  return selectedLeave.halfDaySession || "Half Day";
                })() }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1236,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1231,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1217,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1215,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider block", children: "Justification / Reason" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1254,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-medium text-slate-750 leading-relaxed min-h-[60px] whitespace-pre-line", children: selectedLeave.reason || /* @__PURE__ */ jsxDEV("span", { className: "text-slate-400 italic", children: "No reason provided" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1256,
              columnNumber: 44
            }, this) }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1255,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1253,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider block", children: "Leave Balance" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1262,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 gap-2", children: balances.filter((b) => String(b.leaveType).toUpperCase() === String(selectedLeave.leaveType).toUpperCase()).map(
              (b) => /* @__PURE__ */ jsxDEV("div", { className: "p-2.5 rounded-xl border text-center transition-all bg-indigo-50/20 border-indigo-200", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "text-[9px] font-bold text-slate-400 uppercase", children: b.leaveType }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1266,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "text-xs font-extrabold text-slate-800 mt-0.5", children: [
                  b.available,
                  " ",
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[9px] font-bold text-slate-400 uppercase", children: "Avail" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1267,
                    columnNumber: 99
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1267,
                  columnNumber: 23
                }, this)
              ] }, b.leaveType, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1265,
                columnNumber: 19
              }, this)
            ) }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1263,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1261,
            columnNumber: 15
          }, this),
          selectedLeave.medicalCertUrl && /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider block", children: "Medical Certificate" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1276,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "a",
              {
                href: selectedLeave.medicalCertUrl.startsWith("http") ? selectedLeave.medicalCertUrl : `http://localhost:5009${selectedLeave.medicalCertUrl}`,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "w-full flex items-center justify-center gap-2 py-2 border border-emerald-200 hover:border-emerald-400 bg-emerald-50/20 text-emerald-700 text-xs font-bold rounded-xl transition-all shadow-sm",
                children: [
                  /* @__PURE__ */ jsxDEV(FileText, { size: 14 }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1283,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { children: "View Medical Certificate" }, void 0, false, {
                    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                    lineNumber: 1284,
                    columnNumber: 21
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1277,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1275,
            columnNumber: 15
          }, this),
          (selectedLeave.approvedAt || selectedLeave.rejectedAt || selectedLeave.cancelledAt) && /* @__PURE__ */ jsxDEV("div", { className: "border-t border-slate-100 pt-4 space-y-2 text-[11px] text-slate-500", children: [
            /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider block", children: "Action Trail" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1292,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "space-y-1.5 bg-slate-50/30 border border-slate-100 p-3 rounded-xl", children: [
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-slate-700", children: "Action: " }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1295,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: clsx(
                  "font-bold uppercase",
                  selectedLeave.status === "Approved" && "text-[#16A34A]",
                  (selectedLeave.status === "Rejected" || selectedLeave.status === "Cancelled") && "text-[#DC2626]"
                ), children: selectedLeave.status }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1296,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1294,
                columnNumber: 21
              }, this),
              selectedLeave.actionBy && /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-slate-700", children: "Processed By: " }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1304,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "font-medium", children: [
                  selectedLeave.actionBy.firstName,
                  " ",
                  selectedLeave.actionBy.lastName
                ] }, void 0, true, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1305,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1303,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-slate-700", children: "Processed On: " }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1309,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "font-medium", children: dayjs(selectedLeave.approvedAt || selectedLeave.rejectedAt || selectedLeave.cancelledAt).format("DD-MM-YYYY HH:mm") }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1310,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1308,
                columnNumber: 21
              }, this),
              selectedLeave.rejectionReason && /* @__PURE__ */ jsxDEV("div", { className: "text-rose-600 bg-rose-50/50 p-2 rounded border border-rose-100 mt-1 font-medium", children: [
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-rose-700", children: "Rejection Reason:" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1316,
                  columnNumber: 25
                }, this),
                " ",
                selectedLeave.rejectionReason
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1315,
                columnNumber: 19
              }, this),
              selectedLeave.adminRemark && /* @__PURE__ */ jsxDEV("div", { className: "text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-1 font-medium", children: [
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-slate-700", children: "Admin Remarks:" }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1321,
                  columnNumber: 25
                }, this),
                " ",
                selectedLeave.adminRemark
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1320,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1293,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1291,
            columnNumber: 15
          }, this),
          selectedLeave.meta?.earlyReturnRequest && /* @__PURE__ */ jsxDEV("div", { className: "border-t border-slate-100 pt-4 space-y-2 text-[11px]", children: [
            /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] font-bold text-purple-655 uppercase tracking-wider block", children: "Early Return Request Details" }, void 0, false, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1331,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "bg-purple-50/30 border border-purple-100 p-3 rounded-xl space-y-1.5", children: [
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-purple-700", children: "Proposed Return Date: " }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1334,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-slate-800", children: dayjs(selectedLeave.meta.earlyReturnRequest.actualReturnDate).format("DD-MM-YYYY") }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1335,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1333,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-purple-700", children: "Request Status: " }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1340,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold uppercase text-purple-600", children: selectedLeave.meta.earlyReturnRequest.status }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1341,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1339,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-purple-700", children: "Reason: " }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1346,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "font-medium text-slate-750", children: selectedLeave.meta.earlyReturnRequest.reason }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1347,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1345,
                columnNumber: 21
              }, this),
              selectedLeave.meta.earlyReturnRequest.comments && /* @__PURE__ */ jsxDEV("div", { children: [
                /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-purple-700", children: "Comments: " }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1351,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "font-medium text-slate-650", children: selectedLeave.meta.earlyReturnRequest.comments }, void 0, false, {
                  fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                  lineNumber: 1352,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
                lineNumber: 1350,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
              lineNumber: 1332,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
            lineNumber: 1330,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
          lineNumber: 1201,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 1180,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
        lineNumber: 1179,
        columnNumber: 9
      }, this),
      document.body
    )
  ] }, void 0, true, {
    fileName: "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx",
    lineNumber: 427,
    columnNumber: 5
  }, this);
}
_s(AttendanceModule, "c9bSZgpNYNQMXYtLFiS78Xsk3Wk=", false, function() {
  return [useRBAC, useLocation, useNavigate];
});
_c5 = AttendanceModule;
var _c, _c2, _c3, _c4, _c5;
$RefreshReg$(_c, "SectionHeading");
$RefreshReg$(_c2, "TabButton");
$RefreshReg$(_c3, "SummaryCard");
$RefreshReg$(_c4, "PolicyInsightCard");
$RefreshReg$(_c5, "AttendanceModule");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) {
  return RefreshRuntime.register(type, "C:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/Employee/AttendanceModule.jsx " + id);
}
function $RefreshSig$() {
  return RefreshRuntime.createSignatureFunctionForTransform();
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBb0NJLFNBMi9Cd0IsVUEzL0J4Qjs7QUFwQ0osT0FBT0EsU0FBU0MsVUFBVUMsV0FBV0MsZUFBZTtBQUNwRCxTQUFTQyxhQUFhQyxtQkFBbUI7QUFDekMsU0FBU0Msb0JBQW9CO0FBQzdCO0FBQUEsRUFDRUMsWUFBWUM7QUFBQUEsRUFDWkM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsT0FDSztBQUNQLE9BQU9DLFNBQVM7QUFDaEIsT0FBT0Msd0JBQXdCO0FBQy9CLE9BQU9DLDBCQUEwQjtBQUNqQyxPQUFPQyxvQkFBb0I7QUFDM0IsU0FBU0MsMEJBQTBCO0FBQ25DLFNBQVNDLFlBQVlDLGFBQWE7QUFDbEMsT0FBT0MsV0FBVztBQUNsQixPQUFPQyxVQUFVO0FBQ2pCLFNBQVNDLGVBQWU7QUFDeEIsU0FBU0MsbUNBQW1DO0FBRTVDLE1BQU1DLGlCQUFpQkEsQ0FBQyxFQUFFQyxPQUFPQyxTQUFTLE1BQ3hDLHVCQUFDLFNBQUksV0FBVSxVQUNiO0FBQUEseUJBQUMsUUFBRyxXQUFVLGlFQUFpRUQsbUJBQS9FO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FBcUY7QUFBQSxFQUNwRkMsWUFBWSx1QkFBQyxPQUFFLFdBQVUscURBQXFEQSxzQkFBbEU7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUEyRTtBQUFBLEtBRjFGO0FBQUE7QUFBQTtBQUFBO0FBQUEsT0FHQTtBQUNBQyxLQUxJSDtBQU9OLE1BQU1JLFlBQVlBLENBQUMsRUFBRUMsUUFBUUMsT0FBT0MsUUFBUSxNQUMxQztBQUFBLEVBQUM7QUFBQTtBQUFBLElBQ0M7QUFBQSxJQUNBLFdBQVdWO0FBQUFBLE1BQ1Q7QUFBQSxNQUNBUSxTQUNJLG9DQUNBO0FBQUEsSUFDTjtBQUFBLElBRUEsaUNBQUMsVUFBTUMsbUJBQVA7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUFhO0FBQUE7QUFBQSxFQVRmO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFVQTtBQUNBRSxNQVpJSjtBQWNOLE1BQU1LLGNBQWNBLENBQUMsRUFBRUgsT0FBT0ksT0FBT0MsTUFBTUMsTUFBTUMsUUFBUUMsVUFBVSxNQUNqRSx1QkFBQyxTQUFJLFdBQVUsMklBQ2I7QUFBQSx5QkFBQyxTQUFJLFdBQVUsaUJBQ2I7QUFBQSwyQkFBQyxVQUFLLFdBQVUsMkVBQTJFUixtQkFBM0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUFpRztBQUFBLElBQ2pHLHVCQUFDLFVBQUssV0FBV1QsS0FBSyxzREFBc0RpQixTQUFTLEdBQUlKLG1CQUF6RjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQStGO0FBQUEsT0FGakc7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUdBO0FBQUEsRUFDQSx1QkFBQyxTQUFJLFdBQVdiLEtBQUssNEZBQTRGZ0IsUUFBUUMsU0FBUyxHQUNoSSxpQ0FBQyxRQUFLLE1BQU0sTUFBWjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBQWUsS0FEakI7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUVBO0FBQUEsS0FQRjtBQUFBO0FBQUE7QUFBQTtBQUFBLE9BUUE7QUFDQUMsTUFWSU47QUFZTixNQUFNTyxvQkFBb0JBLENBQUMsRUFBRUMsT0FBTyxNQUNsQztBQUFBLEVBQUM7QUFBQTtBQUFBLElBQ0MsV0FBV3BCO0FBQUFBLE1BQ1Q7QUFBQSxNQUNBb0IsUUFBUUMsY0FBYyxrQ0FBa0M7QUFBQSxJQUMxRDtBQUFBLElBRUE7QUFBQSw2QkFBQyxTQUFJLFdBQVUsMENBQ2I7QUFBQSwrQkFBQyxTQUFJLFdBQVUsNkJBQ2I7QUFBQSxpQ0FBQyxRQUFHLFdBQVUsbUVBQW1FRCxrQkFBUUUsUUFBUSxrQkFBakc7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBZ0g7QUFBQSxVQUMvR0YsUUFBUUMsZUFDUCx1QkFBQyxVQUFLLFdBQVUsdUdBQXNHLHNCQUF0SDtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUE0SDtBQUFBLGFBSGhJO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFLQTtBQUFBLFFBQ0EsdUJBQUMsVUFBSyxXQUFVLG1EQUFrRDtBQUFBO0FBQUEsVUFBUUQsUUFBUUcsZ0JBQWdCO0FBQUEsYUFBbEc7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUF3RztBQUFBLFdBUDFHO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFRQTtBQUFBLE1BR0EsdUJBQUMsU0FBSSxXQUFVLCtCQUNYSCxtQkFBUUksU0FBUyxJQUFJQyxJQUFJLENBQUNDLE1BQU1DLFVBQVU7QUFDMUMsY0FBTUMsUUFBUUMsT0FBT0gsTUFBTUksZ0JBQWdCLENBQUM7QUFDNUMsY0FBTUMsWUFBWUwsTUFBTU0sU0FBU0Q7QUFDakMsY0FBTUUsZ0JBQWdCUCxNQUFNTSxVQUFVRSxLQUFLQyxJQUFJLE1BQU9KLGFBQWEsTUFBTUgsU0FBUyxLQUFNLEdBQUcsSUFBSTtBQUUvRixlQUNFLHVCQUFDLFNBQXVFLFdBQVUsNkVBQ2hGO0FBQUE7QUFBQSxZQUFDO0FBQUE7QUFBQSxjQUNDLFdBQVU7QUFBQSxjQUNWLE9BQU8sRUFBRVEsaUJBQWlCVixNQUFNVyxTQUFTLFVBQVU7QUFBQTtBQUFBLFlBRnJEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxVQUV1RDtBQUFBLFVBRXZELHVCQUFDLFVBQUssV0FBVSx3REFBd0RYLGdCQUFNWSxhQUFhLFdBQTNGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQW1HO0FBQUEsVUFDbkcsdUJBQUMsU0FBSSxXQUFVLDZEQUNiO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxXQUFVO0FBQUEsY0FDVixPQUFPLEVBQUVDLE9BQU8sR0FBR04sYUFBYSxLQUFLRyxpQkFBaUJWLE1BQU1XLFNBQVMsVUFBVTtBQUFBO0FBQUEsWUFGakY7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBRW1GLEtBSHJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBS0E7QUFBQSxVQUNBLHVCQUFDLFVBQUssV0FBVSx5REFDYlgsZ0JBQU1NLFVBQVUsR0FBR0QsYUFBYSxDQUFDLElBQUlILEtBQUssS0FBSyxHQUFHQSxLQUFLLE9BRDFEO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBRUE7QUFBQSxhQWRRLEdBQUdSLFFBQVFvQixPQUFPcEIsUUFBUUUsSUFBSSxJQUFJSSxNQUFNWSxhQUFhWCxLQUFLLElBQXBFO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFlQTtBQUFBLE1BRUosQ0FBQyxLQXhCSDtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBeUJBO0FBQUE7QUFBQTtBQUFBLEVBMUNGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUEyQ0E7QUFDQWMsTUE3Q0l0QjtBQStDTix3QkFBd0J1QixpQkFBaUI7QUFBQSxFQUN2Q0M7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUM7QUFBQUEsRUFDQUMsZ0JBQWdCO0FBQUEsRUFDaEJDLG9CQUFvQjtBQUFBLEVBQ3BCQztBQUFBQSxFQUNBQztBQUFBQSxFQUNBQztBQUFBQSxFQUNBQztBQUFBQSxFQUNBQyxtQkFBbUI7QUFBQSxFQUNuQkMsY0FBYztBQUNoQixHQUFHO0FBQUFDLEtBQUE7QUFDRCxRQUFNLEVBQUVDLGVBQWVDLFNBQVNDLGtCQUFrQixJQUFJN0QsUUFBUTtBQUM5RCxRQUFNOEQsb0JBQW9CSCxjQUFjLHVCQUF1QixLQUFLO0FBQ3BFLFFBQU1JLG9CQUFvQkosY0FBYyx1QkFBdUIsTUFBTTtBQUNyRSxRQUFNSyxzQkFBc0JMLGNBQWMsdUJBQXVCLFFBQVE7QUFDekUsUUFBTU0sb0JBQW9CTixjQUFjLHVCQUF1QixNQUFNO0FBQ3JFLFFBQU1PLHNCQUFzQlAsY0FBYyx1QkFBdUIsUUFBUTtBQUN6RSxRQUFNUSxnQkFBZ0JILHVCQUF1QkQ7QUFDN0MsUUFBTUsscUJBQXFCTCxxQkFBcUJFLHFCQUFxQkM7QUFDckUsUUFBTUcsdUJBQXVCTixxQkFBcUJFLHFCQUFxQkM7QUFDdkUsUUFBTUksb0JBQW9CdEcsUUFBUSxNQUFNaUMsNEJBQTRCeUMsT0FBTyxHQUFHLENBQUNBLE9BQU8sQ0FBQztBQUN2RixRQUFNNkIsdUJBQXVCdkcsUUFBUSxNQUFNO0FBQ3pDLFVBQU13RyxXQUFXQyxNQUFNQyxRQUFReEIsYUFBYSxJQUFJQSxnQkFBZ0I7QUFDaEUsV0FDRXNCLFNBQVNHLEtBQUssQ0FBQ3hELFdBQVdBLFFBQVFDLGVBQWV3RCxPQUFPekQsUUFBUW9CLE9BQU8sRUFBRSxNQUFNcUMsT0FBT3pCLHFCQUFxQixFQUFFLENBQUMsS0FDOUdxQixTQUFTLENBQUMsS0FDVjlCLFNBQVNlLGVBQ1Q7QUFBQSxFQUVKLEdBQUcsQ0FBQ04sbUJBQW1CRCxlQUFlUixTQUFTZSxXQUFXLENBQUM7QUFDM0QsUUFBTW9CLFdBQVc1RyxZQUFZO0FBQzdCLFFBQU02RyxXQUFXNUcsWUFBWTtBQUU3QixRQUFNNkcsZ0JBQWdCL0csUUFBUSxNQUFNO0FBQUEsSUFDbEMrRixvQkFBb0IsZUFBZTtBQUFBLElBQ2xDSSxpQkFBaUJDLHFCQUFzQixXQUFXO0FBQUEsSUFDbERKLHVCQUF1QkssdUJBQXdCLGFBQWE7QUFBQSxFQUFJLEVBQ2pFVyxPQUFPQyxPQUFPLEdBQUcsQ0FBQ2xCLG1CQUFtQkMscUJBQXFCRyxlQUFlQyxvQkFBb0JDLG9CQUFvQixDQUFDO0FBQ3BILFFBQU0sQ0FBQ2EsV0FBV0MsWUFBWSxJQUFJckgsU0FBU2lILGNBQWMsQ0FBQyxLQUFLLFlBQVk7QUFFM0VoSCxZQUFVLE1BQU07QUFDZCxVQUFNcUgsU0FBUyxJQUFJQyxnQkFBZ0JSLFNBQVNTLE1BQU07QUFDbEQsVUFBTUMsV0FBV0gsT0FBT0ksSUFBSSxLQUFLO0FBQ2pDLFFBQUlELFlBQVlSLGNBQWNVLFNBQVNGLFFBQVEsR0FBRztBQUNoREosbUJBQWFJLFFBQVE7QUFBQSxJQUN2QixXQUFXLENBQUNBLFlBQVlSLGNBQWNXLFNBQVMsR0FBRztBQUNoRFAsbUJBQWFKLGNBQWMsQ0FBQyxDQUFDO0FBQUEsSUFDL0I7QUFBQSxFQUNGLEdBQUcsQ0FBQ0YsU0FBU1MsUUFBUVAsYUFBYSxDQUFDO0FBRW5DLFFBQU0sQ0FBQ1ksa0JBQWtCQyxtQkFBbUIsSUFBSTlILFNBQVMsRUFBRStILFFBQVEsT0FBT0MsU0FBUyxNQUFNQyxXQUFXLE1BQU1DLFlBQVksR0FBRyxDQUFDO0FBQzFILFFBQU0sQ0FBQ0MsZUFBZUMsZ0JBQWdCLElBQUlwSSxTQUFTLElBQUk7QUFDdkQsUUFBTSxDQUFDcUksa0JBQWtCQyxtQkFBbUIsSUFBSXRJLFNBQVMsS0FBSztBQUc5RCxRQUFNLENBQUN1SSxjQUFjQyxlQUFlLElBQUl4SSxTQUFTLE9BQU87QUFDeEQsUUFBTSxDQUFDeUksY0FBY0MsZUFBZSxJQUFJMUksU0FBUyxJQUFJO0FBQ3JELFFBQU0sQ0FBQzJJLGFBQWFDLGNBQWMsSUFBSTVJLFNBQVMsQ0FBQztBQUNoRCxRQUFNLENBQUM2SSxnQkFBZ0JDLGlCQUFpQixJQUFJOUksU0FBUyxFQUFFO0FBQ3ZELFFBQU0sQ0FBQytJLGVBQWVDLGdCQUFnQixJQUFJaEosU0FBUyxLQUFLO0FBQ3hELFFBQU0sQ0FBQ2lKLFlBQVlDLGFBQWEsSUFBSWxKLFNBQVMsRUFBRW1KLE1BQU0sSUFBSUMsUUFBUSxHQUFHLENBQUM7QUFDckUsUUFBTSxDQUFDQyxrQkFBa0JDLG1CQUFtQixJQUFJdEosU0FBUyxLQUFLO0FBQzlELFFBQU0sQ0FBQ3VKLGtCQUFrQkMsbUJBQW1CLElBQUl4SixTQUFTLElBQUk7QUFHN0RDLFlBQVUsTUFBTTtBQUNkLFFBQUltSCxjQUFjLFNBQVU7QUFDNUIsVUFBTXFDLGNBQWMsWUFBWTtBQUM5QixVQUFJO0FBQ0YsY0FBTUMsU0FBUyxNQUFNakksSUFBSWlHLElBQUksb0NBQW9DO0FBQ2pFZ0Isd0JBQWdCZ0IsT0FBT0MsTUFBTUMsVUFBVSxJQUFJO0FBQzNDLFlBQUlGLE9BQU9DLE1BQU1oQixhQUFhO0FBQzVCQyx5QkFBZWMsT0FBT0MsS0FBS2hCLFdBQVc7QUFBQSxRQUN4QztBQUFBLE1BQ0YsU0FBU2tCLEdBQUc7QUFDVkMsZ0JBQVFDLE1BQU0sb0NBQW9DRixDQUFDO0FBQUEsTUFDckQ7QUFBQSxJQUNGO0FBQ0FKLGdCQUFZO0FBQUEsRUFDZCxHQUFHLENBQUNyQyxTQUFTLENBQUM7QUFHZG5ILFlBQVUsTUFBTTtBQUNkLFFBQUltSCxjQUFjLFlBQVltQixpQkFBaUIsYUFBYztBQUM3RCxVQUFNeUIsZ0JBQWdCLFlBQVk7QUFDaENoQix1QkFBaUIsSUFBSTtBQUNyQixVQUFJO0FBQ0YsY0FBTWlCLFNBQVMsTUFBTXhJLElBQUlpRyxJQUFJLHNDQUFzQztBQUNuRW9CLDBCQUFrQm1CLE9BQU9OLE1BQU1PLFlBQVksRUFBRTtBQUFBLE1BQy9DLFNBQVNMLEdBQUc7QUFDVkMsZ0JBQVFDLE1BQU0sc0NBQXNDRixDQUFDO0FBQUEsTUFDdkQsVUFBQztBQUNDYix5QkFBaUIsS0FBSztBQUFBLE1BQ3hCO0FBQUEsSUFDRjtBQUNBZ0Isa0JBQWM7QUFBQSxFQUNoQixHQUFHLENBQUM1QyxXQUFXbUIsWUFBWSxDQUFDO0FBRTVCLFFBQU00QixxQkFBcUIsT0FBT04sTUFBTTtBQUN0Q0EsTUFBRU8sZUFBZTtBQUNqQmQsd0JBQW9CLElBQUk7QUFDeEIsUUFBSTtBQUNGLFlBQU03SCxJQUFJNEksS0FBSyx3Q0FBd0M7QUFBQSxRQUNyREMsZUFBZUMsU0FBU3RCLFdBQVdFLElBQUk7QUFBQSxRQUN2Q0MsUUFBUUgsV0FBV0c7QUFBQUEsTUFDckIsQ0FBQztBQUNERixvQkFBYyxFQUFFQyxNQUFNLElBQUlDLFFBQVEsR0FBRyxDQUFDO0FBRXRDLFlBQU1hLFNBQVMsTUFBTXhJLElBQUlpRyxJQUFJLHNDQUFzQztBQUNuRW9CLHdCQUFrQm1CLE9BQU9OLE1BQU1PLFlBQVksRUFBRTtBQUM3Q00sWUFBTSwrREFBK0Q7QUFBQSxJQUN2RSxTQUFTQyxLQUFLO0FBQ1pELFlBQU1DLEtBQUtDLFVBQVVmLE1BQU1JLFNBQVMsc0NBQXNDO0FBQUEsSUFDNUUsVUFBQztBQUNDVCwwQkFBb0IsS0FBSztBQUFBLElBQzNCO0FBQUEsRUFDRjtBQUVBLFFBQU1xQixxQkFBcUIsT0FBT0MsY0FBYztBQUM5Q3BCLHdCQUFvQm9CLFNBQVM7QUFDN0IsUUFBSTtBQUNGLFlBQU1uSixJQUFJNEksS0FBSyx3Q0FBd0NPLFNBQVMsU0FBUztBQUN6RSxZQUFNWCxTQUFTLE1BQU14SSxJQUFJaUcsSUFBSSxzQ0FBc0M7QUFDbkVvQix3QkFBa0JtQixPQUFPTixNQUFNTyxZQUFZLEVBQUU7QUFBQSxJQUMvQyxTQUFTTyxLQUFLO0FBQ1pELFlBQU1DLEtBQUtDLFVBQVVmLE1BQU1JLFNBQVMsMkJBQTJCO0FBQUEsSUFDakUsVUFBQztBQUNDUCwwQkFBb0IsSUFBSTtBQUFBLElBQzFCO0FBQUEsRUFDRjtBQUdBLFFBQU1xQiwwQkFBMEIsWUFBWTtBQUMxQyxRQUFJLENBQUNoRCxpQkFBaUJLLFdBQVk7QUFDbEMsUUFBSTtBQUNGSSwwQkFBb0IsSUFBSTtBQUN4QixZQUFNN0csSUFBSTRJLEtBQUssaUNBQWlDeEMsaUJBQWlCRyxPQUFPLElBQUksRUFBRUUsWUFBWUwsaUJBQWlCSyxXQUFXLENBQUM7QUFDdkhKLDBCQUFvQixFQUFFQyxRQUFRLE9BQU9DLFNBQVMsTUFBTUMsV0FBVyxNQUFNQyxZQUFZLEdBQUcsQ0FBQztBQUNyRjVDLHlCQUFtQjtBQUFBLElBQ3JCLFNBQVN5RSxPQUFPO0FBQ2RELGNBQVFDLE1BQU1BLEtBQUs7QUFDbkJTLFlBQU1ULE1BQU1XLFVBQVVmLE1BQU1JLFNBQVMsZ0NBQWdDO0FBQUEsSUFDdkUsVUFBQztBQUNDekIsMEJBQW9CLEtBQUs7QUFBQSxJQUMzQjtBQUFBLEVBQ0Y7QUFJQSxRQUFNLENBQUN3QyxjQUFjQyxlQUFlLElBQUkvSyxVQUFTLG9CQUFJZ0wsS0FBSyxHQUFFQyxTQUFTLENBQUM7QUFDdEUsUUFBTSxDQUFDQyxhQUFhQyxjQUFjLElBQUluTCxVQUFTLG9CQUFJZ0wsS0FBSyxHQUFFSSxZQUFZLENBQUM7QUFDdkUsUUFBTSxDQUFDQyxtQkFBbUJDLG9CQUFvQixJQUFJdEwsU0FBUyxFQUFFO0FBQzdELFFBQU0sQ0FBQ3VMLFVBQVVDLFdBQVcsSUFBSXhMLFNBQVMsRUFBRTtBQUMzQyxRQUFNLENBQUN5TCxVQUFVQyxXQUFXLElBQUkxTCxTQUFTLENBQUMsQ0FBQztBQUMzQyxRQUFNLENBQUMyTCxvQkFBb0JDLG9CQUFvQixJQUFJNUwsU0FBUyxLQUFLO0FBR2pFLFFBQU0sQ0FBQ2tLLFVBQVUyQixXQUFXLElBQUk3TCxTQUFTLEVBQUU7QUFDM0MsUUFBTSxDQUFDOEwsYUFBYUMsY0FBYyxJQUFJL0wsU0FBUztBQUFBLElBQzdDZ00sV0FBVztBQUFBLElBQ1hDLFNBQVM7QUFBQSxJQUNUQyxTQUFTO0FBQUEsSUFDVEMsVUFBVTtBQUFBLElBQ1YvQyxRQUFRO0FBQUEsRUFDVixDQUFDO0FBQ0QsUUFBTSxDQUFDZ0QsbUJBQW1CQyxvQkFBb0IsSUFBSXJNLFNBQVMsS0FBSztBQUdoRUMsWUFBVSxNQUFNO0FBQ2QsUUFBSThGLHFCQUFxQixDQUFDQyxxQkFBcUJRLGtCQUFtQjtBQUNsRSxRQUFJWSxjQUFjLGNBQWM7QUFDOUJrRix1QkFBaUI7QUFBQSxJQUNuQixXQUFXbEYsY0FBYyxZQUFZO0FBQ25DbUYsMEJBQW9CO0FBQUEsSUFDdEI7QUFBQSxFQUNGLEdBQUcsQ0FBQ25GLFdBQVcwRCxjQUFjSSxhQUFhbEYsbUJBQW1CQyxtQkFBbUJNLHNCQUFzQlIsbUJBQW1CUyxpQkFBaUIsQ0FBQztBQUUzSXZHLFlBQVUsTUFBTTtBQUNkLFFBQUksQ0FBQ2dILGNBQWNXLE9BQVE7QUFDM0IsUUFBSSxDQUFDWCxjQUFjVSxTQUFTUCxTQUFTLEdBQUc7QUFDdENDLG1CQUFhSixjQUFjLENBQUMsQ0FBQztBQUFBLElBQy9CO0FBQUEsRUFDRixHQUFHLENBQUNHLFdBQVdILGFBQWEsQ0FBQztBQUU3QixRQUFNcUYsbUJBQW1CLFlBQVk7QUFDbkMsUUFBSSxDQUFDckcsa0JBQW1CO0FBQ3hCLFFBQUk7QUFDRjJGLDJCQUFxQixJQUFJO0FBQ3pCLFlBQU0sQ0FBQ1ksUUFBUUMsWUFBWUMsV0FBVyxJQUFJLE1BQU1DLFFBQVFDO0FBQUFBLFFBQUk7QUFBQSxVQUMxRG5MLElBQUlpRyxJQUFJLHdCQUF3Qm9ELGVBQWUsQ0FBQyxTQUFTSSxXQUFXLEVBQUU7QUFBQSxVQUN0RXpKLElBQUlpRyxJQUFJLFdBQVc7QUFBQSxVQUNuQmpHLElBQUlpRyxJQUFJLHNCQUFzQjtBQUFBLFFBQUM7QUFBQSxNQUNoQztBQUNENEQsMkJBQXFCa0IsT0FBTzdDLFFBQVEsRUFBRTtBQUN0QzZCLGtCQUFZaUIsV0FBVzlDLFFBQVEsRUFBRTtBQUNqQytCLGtCQUFZZ0IsWUFBWS9DLFFBQVEsQ0FBQyxDQUFDO0FBQUEsSUFDcEMsU0FBU2MsS0FBSztBQUNaWCxjQUFRQyxNQUFNVSxHQUFHO0FBQUEsSUFDbkIsVUFBQztBQUNDbUIsMkJBQXFCLEtBQUs7QUFBQSxJQUM1QjtBQUFBLEVBQ0Y7QUFFQSxRQUFNVyxzQkFBc0IsWUFBWTtBQUN0QyxRQUFJLENBQUNoRyxxQkFBc0I7QUFDM0IsUUFBSTtBQUNGLFlBQU1zRyxNQUFNLE1BQU1wTCxJQUFJaUcsSUFBSSw2QkFBNkI7QUFDdkRtRSxrQkFBWWdCLElBQUlsRCxLQUFLQSxRQUFRLEVBQUU7QUFBQSxJQUNqQyxTQUFTYyxLQUFLO0FBQ1pYLGNBQVFDLE1BQU1VLEdBQUc7QUFBQSxJQUNuQjtBQUFBLEVBQ0Y7QUFFQSxRQUFNcUMsc0JBQXNCLE9BQU9qRCxNQUFNO0FBQ3ZDQSxNQUFFTyxlQUFlO0FBQ2pCLFFBQUksQ0FBQ2xFLG9CQUFxQjtBQUMxQixRQUFJLENBQUM0RixZQUFZRSxhQUFhLENBQUNGLFlBQVkxQyxPQUFRO0FBRW5ELFFBQUk7QUFDRmlELDJCQUFxQixJQUFJO0FBQ3pCLFlBQU1VLFVBQVU7QUFBQSxRQUNkQyxVQUFVO0FBQUEsUUFDVmhCLFdBQVdGLFlBQVlFO0FBQUFBLFFBQ3ZCQyxTQUFTSCxZQUFZRyxXQUFXSCxZQUFZRTtBQUFBQSxRQUM1Q2lCLFdBQVc7QUFBQSxRQUNYN0QsUUFBUTBDLFlBQVkxQztBQUFBQSxRQUNwQjhELGVBQWU7QUFBQSxVQUNiaEIsU0FBU0osWUFBWUksVUFBVSxHQUFHSixZQUFZRSxTQUFTLElBQUlGLFlBQVlJLE9BQU8sUUFBUTtBQUFBLFVBQ3RGQyxVQUFVTCxZQUFZSSxVQUFVLEdBQUdKLFlBQVlFLFNBQVMsSUFBSUYsWUFBWUksT0FBTyxRQUFRO0FBQUEsVUFDdkZpQixTQUFTckIsWUFBWUksVUFBVSxHQUFHSixZQUFZRSxTQUFTLElBQUlGLFlBQVlJLE9BQU8sUUFBUTtBQUFBLFVBQ3RGa0IsVUFBVXRCLFlBQVlLLFdBQVcsR0FBR0wsWUFBWUUsU0FBUyxJQUFJRixZQUFZSyxRQUFRLFFBQVE7QUFBQSxRQUMzRjtBQUFBLE1BQ0Y7QUFDQSxZQUFNMUssSUFBSTRJLEtBQUssNEJBQTRCMEMsT0FBTztBQUNsRHZDLFlBQU0sMENBQTBDO0FBQ2hEdUIscUJBQWUsRUFBRUMsV0FBVyxJQUFJQyxTQUFTLElBQUlDLFNBQVMsSUFBSUMsVUFBVSxJQUFJL0MsUUFBUSxHQUFHLENBQUM7QUFDcEZtRCwwQkFBb0I7QUFBQSxJQUN0QixTQUFTOUIsS0FBSztBQUNaRCxZQUFNQyxJQUFJQyxVQUFVZixNQUFNSSxTQUFTLG1CQUFtQjtBQUFBLElBQ3hELFVBQUM7QUFDQ3NDLDJCQUFxQixLQUFLO0FBQUEsSUFDNUI7QUFBQSxFQUNGO0FBRUEsUUFBTWdCLGlCQUFpQkEsQ0FBQ0MsV0FBVztBQUNqQyxVQUFNQyxJQUFJRCxRQUFRRSxZQUFZLEtBQUs7QUFDbkMsVUFBTUMsT0FBTztBQUViLFFBQUlGLE1BQU0sV0FBWSxRQUNwQix1QkFBQyxVQUFLLFdBQVdFLE9BQU8sa0JBQ3RCO0FBQUEsNkJBQUMsU0FBSSxXQUFVLDJDQUFmO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBdUQ7QUFBQSxNQUFNO0FBQUEsU0FEL0Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUdBO0FBRUYsUUFBSUYsTUFBTSxjQUFjQSxNQUFNLFlBQWEsUUFDekMsdUJBQUMsVUFBSyxXQUFXRSxPQUFPLGtCQUN0QjtBQUFBLDZCQUFDLFNBQUksV0FBVSwyQ0FBZjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQXVEO0FBQUEsTUFDdERGLE1BQU0sYUFBYSxhQUFhO0FBQUEsU0FGbkM7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUdBO0FBRUYsV0FDRSx1QkFBQyxVQUFLLFdBQVdFLE9BQU8sa0JBQ3RCO0FBQUEsNkJBQUMsU0FBSSxXQUFVLHlEQUFmO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBcUU7QUFBQSxNQUFNO0FBQUEsU0FEN0U7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUdBO0FBQUEsRUFFSjtBQUVBLE1BQUkxSCxtQkFBbUI7QUFDckIsV0FBTztBQUFBLEVBQ1Q7QUFFQSxNQUFJLENBQUNDLG1CQUFtQjtBQUN0QixXQUNFLHVCQUFDLFNBQUksV0FBVSwrREFDYixpQ0FBQyxTQUFJLFdBQVUsMEZBQ2I7QUFBQSw2QkFBQyxTQUFJLFdBQVUsbUdBQ2IsaUNBQUMsZUFBWSxNQUFNLE1BQW5CO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBc0IsS0FEeEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUVBO0FBQUEsTUFDQSx1QkFBQyxRQUFHLFdBQVUsNENBQTJDLDRDQUF6RDtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBQXFGO0FBQUEsTUFDckYsdUJBQUMsT0FBRSxXQUFVLDJDQUEwQyxnR0FBdkQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUVBO0FBQUEsU0FQRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBUUEsS0FURjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBVUE7QUFBQSxFQUVKO0FBRUEsTUFBSVEsbUJBQW1CO0FBQ3JCLFdBQ0UsdUJBQUMsU0FBSSxXQUFVLCtEQUNiLGlDQUFDLFNBQUksV0FBVSwwRkFDYjtBQUFBLDZCQUFDLFNBQUksV0FBVSxtR0FDYixpQ0FBQyxlQUFZLE1BQU0sTUFBbkI7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQUFzQixLQUR4QjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBRUE7QUFBQSxNQUNBLHVCQUFDLFFBQUcsV0FBVSw0Q0FBMkMsdUNBQXpEO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBZ0Y7QUFBQSxNQUNoRix1QkFBQyxPQUFFLFdBQVUsMkNBQTBDLHFIQUF2RDtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBRUE7QUFBQSxTQVBGO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FRQSxLQVRGO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FVQTtBQUFBLEVBRUo7QUFFQSxTQUNFLHVCQUFDLFNBQUksV0FBVSwyREFDYjtBQUFBLDJCQUFDLFNBQUksV0FBVSx1Q0FHWm5HO0FBQUFBO0FBQUFBLFFBQ0MsdUJBQUMsU0FBSSxXQUFVLGlEQUNiLGlDQUFDLFNBQUksV0FBVSxRQUNaNEY7QUFBQUEsK0JBQ0M7QUFBQSxZQUFDO0FBQUE7QUFBQSxjQUNDLFFBQVFtQixjQUFjO0FBQUEsY0FDdEIsT0FBTTtBQUFBLGNBQ04sU0FBUyxNQUFNSixTQUFTLHFDQUFxQztBQUFBO0FBQUEsWUFIL0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBR2lFO0FBQUEsV0FHakVYLGlCQUFpQkMsdUJBQ2pCO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxRQUFRYyxjQUFjO0FBQUEsY0FDdEIsT0FBTTtBQUFBLGNBQ04sU0FBUyxNQUFNSixTQUFTLGlDQUFpQztBQUFBO0FBQUEsWUFIM0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBRzZEO0FBQUEsV0FHN0RkLHVCQUF1QksseUJBQ3ZCO0FBQUEsWUFBQztBQUFBO0FBQUEsY0FDQyxRQUFRYSxjQUFjO0FBQUEsY0FDdEIsT0FBTTtBQUFBLGNBQ04sU0FBUyxNQUFNSixTQUFTLG1DQUFtQztBQUFBO0FBQUEsWUFIN0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBRytEO0FBQUEsYUFuQm5FO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFzQkEsS0F2QkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQXdCQTtBQUFBLFFBQ0EwRyxTQUFTQyxlQUFlLHlCQUF5QixLQUFLRCxTQUFTRTtBQUFBQSxNQUNqRTtBQUFBLE1BRUEsdUJBQUMsU0FBSSxXQUFVLDBHQUdaeEc7QUFBQUEsc0JBQWMsZ0JBQ2IsdUJBQUMsU0FBSSxXQUFVLGFBRWI7QUFBQSxpQ0FBQyxTQUFJLFdBQVUsc0hBQ2IsaUNBQUMsU0FBSSxXQUFVLHlDQUNiO0FBQUEsbUNBQUMsZUFBWSxPQUFNLGdCQUFlLE9BQU92QyxNQUFNZ0osYUFBYSxNQUFNbE4sYUFBYSxRQUFPLGdCQUFlLFdBQVUsb0JBQS9HO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQStIO0FBQUEsWUFDL0gsdUJBQUMsZUFBWSxPQUFNLGVBQWMsT0FBT2tFLE1BQU1pSixrQkFBa0IsR0FBRyxNQUFNbE4sYUFBYSxRQUFPLGdCQUFlLFdBQVUsb0JBQXRIO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQXNJO0FBQUEsWUFDdEksdUJBQUMsZUFBWSxPQUFNLGdCQUFlLE9BQU9pRSxNQUFNa0osYUFBYSxNQUFNek0sT0FBTyxRQUFPLGdCQUFlLFdBQVUsb0JBQXpHO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQXlIO0FBQUEsZUFIM0g7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFJQSxLQUxGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBTUE7QUFBQSxVQUdDbUssVUFBVXVDLGtCQUNULHVCQUFDLFNBQUksV0FBVSwwTEFDYjtBQUFBLG1DQUFDLFNBQUksV0FBVSwyQkFDYjtBQUFBLHFDQUFDLFNBQUksV0FBVSwwRkFDYixpQ0FBQyxTQUFNLE1BQU0sTUFBYjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUFnQixLQURsQjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUVBO0FBQUEsY0FDQSx1QkFBQyxTQUNDO0FBQUEsdUNBQUMsUUFBRyxXQUFVLG9DQUFvQ3ZDLG1CQUFTdUMsZUFBZXpLLFFBQTFFO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQStFO0FBQUEsZ0JBQy9FLHVCQUFDLE9BQUUsV0FBVSxzQ0FBcUMsc0RBQWxEO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQXdGO0FBQUEsbUJBRjFGO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBR0E7QUFBQSxpQkFQRjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQVFBO0FBQUEsWUFDQSx1QkFBQyxTQUFJLFdBQVUsbUVBQ2IsaUNBQUMsU0FBSSxXQUFVLDJCQUNiO0FBQUEscUNBQUMsU0FBSSxXQUFVLHVEQUFmO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQW1FO0FBQUEsY0FDbkUsdUJBQUMsVUFBSyxXQUFVLG9DQUNia0k7QUFBQUEseUJBQVN1QyxlQUFlQztBQUFBQSxnQkFBVTtBQUFBLGdCQUFLeEMsU0FBU3VDLGVBQWVFO0FBQUFBLG1CQURsRTtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUVBO0FBQUEsY0FDQ3pDLFNBQVN1QyxlQUFlRyxnQkFDdkIsdUJBQUMsVUFBSyxXQUFVLDhHQUE2RywyQkFBN0g7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBd0k7QUFBQSxpQkFONUk7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFRQSxLQVRGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBVUE7QUFBQSxlQXBCRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQXFCQTtBQUFBLFVBR0Y7QUFBQSxZQUFDO0FBQUE7QUFBQSxjQUNDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUE7QUFBQSxZQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxVQUl5QztBQUFBLFVBR3pDLHVCQUFDLFNBQUksV0FBVSx5RUFDYixpQ0FBQyxTQUFJLFdBQVUsa0JBQ2I7QUFBQSxZQUFDO0FBQUE7QUFBQSxjQUNDLE1BQU05QztBQUFBQSxjQUNOO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0EsZ0JBQ0UsdUJBQUMsU0FBSSxXQUFVLDBGQUNiO0FBQUEsdUNBQUMsWUFBTyxTQUFTLE1BQU1GLGVBQWUsQ0FBQWlELE1BQUtBLElBQUksQ0FBQyxHQUFHLFdBQVUsc0lBQzNELGlDQUFDLFNBQUksV0FBVSxnQ0FDYjtBQUFBLHlDQUFDLGVBQVksTUFBTSxNQUFuQjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUFzQjtBQUFBLGtCQUN0Qix1QkFBQyxlQUFZLE1BQU0sTUFBbkI7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBc0I7QUFBQSxxQkFGeEI7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFHQSxLQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBS0E7QUFBQSxnQkFDQSx1QkFBQyxZQUFPLFNBQVMsTUFBTTtBQUFFLHNCQUFJdEQsaUJBQWlCLEdBQUc7QUFBRUMsb0NBQWdCLEVBQUU7QUFBR0ksbUNBQWUsQ0FBQWlELE1BQUtBLElBQUksQ0FBQztBQUFBLGtCQUFHLE1BQU9yRCxpQkFBZ0IsQ0FBQXNELE1BQUtBLElBQUksQ0FBQztBQUFBLGdCQUFHLEdBQUcsV0FBVSxzSUFBcUksaUNBQUMsZUFBWSxNQUFNLE1BQW5CO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQXNCLEtBQWhUO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQW1UO0FBQUEsZ0JBQ25ULHVCQUFDLFVBQUssV0FBVSxrRkFBa0ZyTSxnQkFBTSxJQUFJZ0osS0FBS0UsYUFBYUosWUFBWSxDQUFDLEVBQUV3RCxPQUFPLFVBQVUsS0FBOUo7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBZ0s7QUFBQSxnQkFDaEssdUJBQUMsWUFBTyxTQUFTLE1BQU07QUFBRSxzQkFBSXhELGlCQUFpQixJQUFJO0FBQUVDLG9DQUFnQixDQUFDO0FBQUdJLG1DQUFlLENBQUFpRCxNQUFLQSxJQUFJLENBQUM7QUFBQSxrQkFBRyxNQUFPckQsaUJBQWdCLENBQUFzRCxNQUFLQSxJQUFJLENBQUM7QUFBQSxnQkFBRyxHQUFHLFdBQVUsc0lBQXFJLGlDQUFDLGdCQUFhLE1BQU0sTUFBcEI7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBdUIsS0FBalQ7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBb1Q7QUFBQSxnQkFDcFQsdUJBQUMsWUFBTyxTQUFTLE1BQU1sRCxlQUFlLENBQUFpRCxNQUFLQSxJQUFJLENBQUMsR0FBRyxXQUFVLHNJQUMzRCxpQ0FBQyxTQUFJLFdBQVUsZ0NBQ2I7QUFBQSx5Q0FBQyxnQkFBYSxNQUFNLE1BQXBCO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQXVCO0FBQUEsa0JBQ3ZCLHVCQUFDLGdCQUFhLE1BQU0sTUFBcEI7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBdUI7QUFBQSxxQkFGekI7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFHQSxLQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBS0E7QUFBQSxtQkFmRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQWdCQTtBQUFBO0FBQUEsWUF4Qko7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBeUJHLEtBMUJMO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBNEJBLEtBN0JGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBOEJBO0FBQUEsYUF6RUY7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQTBFQTtBQUFBLFFBSURoSCxjQUFjLFlBQ2IsdUJBQUMsU0FBSSxXQUFVLDREQUNiO0FBQUEsaUNBQUMsU0FBSSxXQUFVLGFBQ2I7QUFBQSxtQ0FBQyxTQUFJLFdBQVUscUNBQ2IsaUNBQUMsa0JBQWUsT0FBTSxvQkFBdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBc0MsS0FEeEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFFQTtBQUFBLFlBRUMxQixvQkFDQyx1QkFBQyxTQUFJLFdBQVUsZ0lBQ2I7QUFBQSxxQ0FBQyxTQUFJLFdBQVUsbUVBQ2I7QUFBQSx1Q0FBQyxTQUNDO0FBQUEseUNBQUMsU0FBSSxXQUFVLGtDQUNiO0FBQUEsMkNBQUMsVUFBSyxXQUFVLHNEQUFoQjtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUFrRTtBQUFBLG9CQUNsRSx1QkFBQyxRQUFHLFdBQVUsZ0VBQStELHVDQUE3RTtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUFvRztBQUFBLHVCQUZ0RztBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUdBO0FBQUEsa0JBQ0EsdUJBQUMsT0FBRSxXQUFVLHlEQUF3RCwySEFBckU7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFFQTtBQUFBLHFCQVBGO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBUUE7QUFBQSxnQkFDQ0MsZUFDQyx1QkFBQyxTQUFJLFdBQVUsOERBQ2I7QUFBQSx5Q0FBQyxVQUFLLFdBQVUsK0VBQThFLDhCQUE5RjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUE0RztBQUFBLGtCQUM1Ryx1QkFBQyxVQUFLLFdBQVUsOENBQ1osaUJBQU07QUFDTiwwQkFBTTRJLFNBQVM1SSxZQUFZbEMsT0FBT29ELEtBQUssQ0FBQTJILE1BQUtBLEVBQUVqSyxjQUFjLElBQUk7QUFDaEUsd0JBQUlnSyxVQUFVQSxPQUFPRSw0QkFBNEI7QUFDL0MsNEJBQU1DLFFBQVE7QUFDZCwwQkFBSUgsT0FBT0ksaUJBQWlCLE1BQU9ELE9BQU1FLEtBQUssR0FBRztBQUNqRCwwQkFBSUwsT0FBT00sZ0JBQWdCLE1BQU9ILE9BQU1FLEtBQUssSUFBSTtBQUNqRCwwQkFBSUwsT0FBT08saUJBQWlCLE1BQU9KLE9BQU1FLEtBQUssSUFBSTtBQUNsRCwwQkFBSUwsT0FBT1EsaUJBQWlCLE1BQU9MLE9BQU1FLEtBQUssSUFBSTtBQUNsRCwwQkFBSUwsT0FBT1MsbUJBQW1CLE1BQU9OLE9BQU1FLEtBQUssSUFBSTtBQUNwRCwwQkFBSUwsT0FBT1UsZUFBZ0JQLE9BQU1FLEtBQUssSUFBSTtBQUMxQyw2QkFBTyxJQUFJRixNQUFNUSxLQUFLLEtBQUssQ0FBQyxRQUFRWCxPQUFPWSxxQkFBcUIsRUFBRTtBQUFBLG9CQUNwRTtBQUNBLDJCQUFPO0FBQUEsa0JBQ1QsR0FBRyxLQWRMO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBZUE7QUFBQSxxQkFqQkY7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFrQkE7QUFBQSxtQkE3Qko7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkErQkE7QUFBQSxjQUVBLHVCQUFDLFNBQUksV0FBVSxpRkFDYjtBQUFBLHVDQUFDLFNBQUksV0FBVSw0REFDYjtBQUFBLHlDQUFDLFVBQUssV0FBVSx3RUFBdUUsK0JBQXZGO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQXNHO0FBQUEsa0JBQ3RHLHVCQUFDLFVBQUssV0FBVSxxQ0FDWGxLO0FBQUFBLGlDQUFZLElBQUk0QixLQUFLLENBQUF1SSxNQUFLQSxFQUFFN0ssY0FBYyxJQUFJLEdBQUdQLGFBQWE7QUFBQSxvQkFBRztBQUFBLHVCQUR0RTtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUVBO0FBQUEscUJBSkY7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFLQTtBQUFBLGdCQUNBLHVCQUFDLFNBQUksV0FBVSw0REFDYjtBQUFBLHlDQUFDLFVBQUssV0FBVSx3RUFBdUUsMENBQXZGO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQWlIO0FBQUEsa0JBQ2pILHVCQUFDLFVBQUssV0FBVSxxQ0FDYjBCLDJCQUFpQjJKLGlCQUFpQixPQUFPLEdBQUczSixpQkFBaUIySixZQUFZLFVBQVUsU0FEdEY7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFFQTtBQUFBLHFCQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBS0E7QUFBQSxnQkFDQSx1QkFBQyxTQUFJLFdBQVUsNERBQ2I7QUFBQSx5Q0FBQyxVQUFLLFdBQVUsd0VBQXVFLDJCQUF2RjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUFrRztBQUFBLGtCQUNsRyx1QkFBQyxVQUFLLFdBQVUscUNBQ2IzSjtBQUFBQSxxQ0FBaUJ5RCxRQUFRO0FBQUEsb0JBQUU7QUFBQSx1QkFEOUI7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFFQTtBQUFBLHFCQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBS0E7QUFBQSxnQkFDQSx1QkFBQyxTQUFJLFdBQVUsNERBQ2I7QUFBQSx5Q0FBQyxVQUFLLFdBQVUsd0VBQXVFLGlDQUF2RjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUF3RztBQUFBLGtCQUN4Ryx1QkFBQyxVQUFLLFdBQVcsK0NBQStDekQsaUJBQWlCeUQsT0FBTyxJQUFJLG9CQUFvQixnQkFBZ0IsSUFDN0h6RCwyQkFBaUI0SixrQkFBa0IsU0FEdEM7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFFQTtBQUFBLHFCQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBS0E7QUFBQSxtQkF4QkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkF5QkE7QUFBQSxpQkEzREY7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkE0REE7QUFBQSxZQUdGLHVCQUFDLFNBQUksV0FBVSx3REFDWnJLLG1CQUFTdkIsSUFBSSxDQUFDMEwsR0FBR0csTUFBTTtBQUN0QixvQkFBTUMsYUFBYXRLLE9BQU9nQyxPQUFPLENBQUF1SSxNQUFLQSxFQUFFbEwsY0FBYzZLLEVBQUU3SyxTQUFTO0FBQ2pFLG9CQUFNbUwsT0FBT0YsV0FBV3RJLE9BQU8sQ0FBQXVJLE1BQUtBLEVBQUVuQyxRQUFRRSxZQUFZLE1BQU0sVUFBVSxFQUFFbUMsT0FBTyxDQUFDQyxLQUFLQyxTQUFTRCxPQUFPQyxLQUFLQyxhQUFhLElBQUksQ0FBQztBQUNoSSxvQkFBTUMsVUFBVVAsV0FBV3RJLE9BQU8sQ0FBQXVJLE1BQUtBLEVBQUVuQyxRQUFRRSxZQUFZLE1BQU0sU0FBUyxFQUFFbUMsT0FBTyxDQUFDQyxLQUFLQyxTQUFTRCxPQUFPQyxLQUFLQyxhQUFhLElBQUksQ0FBQztBQUNsSSxvQkFBTUUsWUFBWVosRUFBRXBMLGFBQWE7QUFDakMsb0JBQU1ILFFBQVF1TCxFQUFFdkwsU0FBVTZMLE9BQU9NO0FBRWpDLG9CQUFNQyxTQUFTO0FBQUEsZ0JBQ2JDLE1BQU07QUFBQSxnQkFDTkMsSUFBSTtBQUFBLGdCQUNKQyxRQUFRO0FBQUEsZ0JBQ1JDLFFBQVE7QUFBQSxjQUNWO0FBRUEscUJBQ0UsdUJBQUMsU0FBMkIsV0FBV3BPLEtBQUssMEdBQTBHZ08sT0FBT0csTUFBTSxHQUVqSztBQUFBLHVDQUFDLFNBQUksV0FBV25PLEtBQUssb0NBQW9DZ08sT0FBT0ksTUFBTSxLQUF0RTtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUF3RTtBQUFBLGdCQUV4RSx1QkFBQyxTQUFJLFdBQVUsMENBQ2I7QUFBQSx5Q0FBQyxVQUFLLFdBQVUsK0RBQStEakIsWUFBRTdLLGFBQWpGO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQTJGO0FBQUEsa0JBQzFGeUwsY0FBYyxJQUNiLHVCQUFDLFVBQUssV0FBVSw0RUFBMkUseUJBQTNGO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQW9HLElBRXBHLHVCQUFDLFVBQUssV0FBVy9OLEtBQUssZ0RBQWdEZ08sT0FBT0UsSUFBSUYsT0FBT0MsSUFBSSxHQUFHLHlCQUEvRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUF3RztBQUFBLHFCQUw1RztBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQU9BO0FBQUEsZ0JBRUEsdUJBQUMsU0FBSSxXQUFVLG9DQUNiO0FBQUEseUNBQUMsVUFBSyxXQUFVLG1EQUFtREYsdUJBQW5FO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQTZFO0FBQUEsa0JBQzdFLHVCQUFDLFVBQUssV0FBVSxvQ0FBbUMscUJBQW5EO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQXdEO0FBQUEscUJBRjFEO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBR0E7QUFBQSxnQkFFQSx1QkFBQyxTQUFJLFdBQVUsc0RBQ2I7QUFBQSx5Q0FBQyxTQUFJLFdBQVUsOERBQ2I7QUFBQSwyQ0FBQyxVQUFLLFdBQVUsa0RBQWlELG1CQUFqRTtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUFvRTtBQUFBLG9CQUNwRSx1QkFBQyxVQUFLLFdBQVUsb0NBQW9Dbk0sbUJBQXBEO0FBQUE7QUFBQTtBQUFBO0FBQUEsMkJBQTBEO0FBQUEsdUJBRjVEO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBR0E7QUFBQSxrQkFDQSx1QkFBQyxTQUFJLFdBQVUsbUVBQ2I7QUFBQSwyQ0FBQyxVQUFLLFdBQVUsb0RBQW1ELG1CQUFuRTtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUFzRTtBQUFBLG9CQUN0RSx1QkFBQyxVQUFLLFdBQVUsc0NBQXNDNkwsa0JBQXREO0FBQUE7QUFBQTtBQUFBO0FBQUEsMkJBQTJEO0FBQUEsdUJBRjdEO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBR0E7QUFBQSxrQkFDQSx1QkFBQyxTQUFJLFdBQVUsaUVBQ2I7QUFBQSwyQ0FBQyxVQUFLLFdBQVUsa0RBQWlELG9CQUFqRTtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUFxRTtBQUFBLG9CQUNyRSx1QkFBQyxVQUFLLFdBQVd6TixLQUFLLHFCQUFxQjhOLFVBQVUsSUFBSSxtQkFBbUIsZ0JBQWdCLEdBQUlBLHFCQUFoRztBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUF3RztBQUFBLHVCQUYxRztBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUdBO0FBQUEscUJBWkY7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFhQTtBQUFBLG1CQS9CUVgsRUFBRTdLLGFBQWFnTCxHQUF6QjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQWdDQTtBQUFBLFlBRUosQ0FBQyxLQWxESDtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQW1EQTtBQUFBLGVBeEhGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBeUhBO0FBQUEsVUFHRDlHLGNBQWM2SCxXQUNiLHVCQUFDLFNBQUksV0FBVSxtQkFDYjtBQUFBO0FBQUEsY0FBQztBQUFBO0FBQUEsZ0JBQ0MsU0FBUyxNQUFNOUgsZ0JBQWdCLE9BQU87QUFBQSxnQkFDdEMsV0FBV3ZHO0FBQUFBLGtCQUFLO0FBQUEsa0JBQ2RzRyxpQkFBaUIsVUFBVSxzQ0FBc0M7QUFBQSxnQkFBd0U7QUFBQSxnQkFFM0k7QUFBQSx5Q0FBQyxTQUFNLE1BQU0sTUFBYjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUFnQjtBQUFBLGtCQUFHO0FBQUE7QUFBQTtBQUFBLGNBTHJCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxZQU1BO0FBQUEsWUFDQTtBQUFBLGNBQUM7QUFBQTtBQUFBLGdCQUNDLFNBQVMsTUFBTUMsZ0JBQWdCLFlBQVk7QUFBQSxnQkFDM0MsV0FBV3ZHO0FBQUFBLGtCQUFLO0FBQUEsa0JBQ2RzRyxpQkFBaUIsZUFBZSx1Q0FBdUM7QUFBQSxnQkFBd0U7QUFBQSxnQkFFako7QUFBQSx5Q0FBQyxjQUFXLE1BQU0sTUFBbEI7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBcUI7QUFBQSxrQkFBRztBQUFBO0FBQUE7QUFBQSxjQUwxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsWUFNQTtBQUFBLGVBZEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFlQTtBQUFBLFVBR0RBLGlCQUFpQixXQUNoQix1QkFBQyxTQUFJLFdBQVUsc0RBRVpsQztBQUFBQSw2QkFDQyx1QkFBQyxTQUFJLFdBQVUsaUJBQ2I7QUFBQSxxQ0FBQyxrQkFBZSxPQUFNLHFCQUF0QjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUF1QztBQUFBLGNBQ3ZDO0FBQUEsZ0JBQUM7QUFBQTtBQUFBLGtCQUNDO0FBQUEsa0JBQ0EsZ0JBQWdCbkI7QUFBQUEsa0JBQ2hCLFVBQVVNO0FBQUFBLGtCQUNWLFdBQVcsTUFBTTtBQUFFQyxpQ0FBYSxJQUFJO0FBQUdILHVDQUFtQjtBQUFBLGtCQUFHO0FBQUEsa0JBQzdELGNBQWMsTUFBTUcsYUFBYSxJQUFJO0FBQUEsa0JBQ3JDO0FBQUEsa0JBQ0EsYUFBYWdCO0FBQUFBLGtCQUNiO0FBQUE7QUFBQSxnQkFSRjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsY0FRaUM7QUFBQSxpQkFWbkM7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFZQTtBQUFBLFlBSUYsdUJBQUMsU0FBSSxXQUFXeEUsS0FBSyxpQkFBaUIsQ0FBQ29FLGlCQUFpQixnQkFBZ0IsR0FDdEU7QUFBQSxxQ0FBQyxTQUFJLFdBQVUsMENBQ2I7QUFBQSx1Q0FBQyxrQkFBZSxPQUFNLG9CQUF0QjtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUFzQztBQUFBLGdCQUN0Qyx1QkFBQyxVQUFLLFdBQVUsMEVBQTBFbkI7QUFBQUEseUJBQU8wQztBQUFBQSxrQkFBTztBQUFBLHFCQUF4RztBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUE4RztBQUFBLG1CQUZoSDtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUdBO0FBQUEsY0FFQSx1QkFBQyxTQUFJLFdBQVUsYUFDWixXQUFDdEIscUJBQ0EsdUJBQUMsU0FBSSxXQUFVLHlIQUNiO0FBQUEsdUNBQUMsZUFBWSxNQUFNLElBQUksV0FBVSwyQkFBakM7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBd0Q7QUFBQSxnQkFDeEQsdUJBQUMsT0FBRSxXQUFVLG1FQUFrRSxnREFBL0U7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBK0c7QUFBQSxtQkFGakg7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFHQSxJQUNFcEIsT0FBTzBDLFNBQVMsSUFDbEIsQ0FBQyxHQUFHMUMsTUFBTSxFQUFFcUwsS0FBSyxDQUFDQyxHQUFHcEIsTUFBTSxJQUFJcEUsS0FBS29FLEVBQUVwRCxTQUFTLElBQUksSUFBSWhCLEtBQUt3RixFQUFFeEUsU0FBUyxDQUFDLEVBQUV0STtBQUFBQSxnQkFBSSxDQUFDK00sT0FBT2xCLE1BQ3BGLHVCQUFDLFNBQVksU0FBUyxNQUFNbkgsaUJBQWlCcUksS0FBSyxHQUFHLFdBQVUsZ0tBQzdEO0FBQUEseUNBQUMsU0FBSSxXQUFVLDJCQUNiO0FBQUEsMkNBQUMsU0FBSSxXQUFVLGtIQUNiO0FBQUEsNkNBQUMsVUFBSyxXQUFVLGtGQUFrRnpPLGdCQUFNeU8sTUFBTXpFLFNBQVMsRUFBRXNDLE9BQU8sS0FBSyxLQUFySTtBQUFBO0FBQUE7QUFBQTtBQUFBLDZCQUF1STtBQUFBLHNCQUN2SSx1QkFBQyxVQUFLLFdBQVUsMENBQTBDdE0sZ0JBQU15TyxNQUFNekUsU0FBUyxFQUFFc0MsT0FBTyxJQUFJLEtBQTVGO0FBQUE7QUFBQTtBQUFBO0FBQUEsNkJBQThGO0FBQUEseUJBRmhHO0FBQUE7QUFBQTtBQUFBO0FBQUEsMkJBR0E7QUFBQSxvQkFDQSx1QkFBQyxTQUNDO0FBQUEsNkNBQUMsU0FBSSxXQUFVLGtDQUNiO0FBQUEsK0NBQUMsUUFBRyxXQUFVLG9DQUFvQ21DLGdCQUFNbE0sYUFBeEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFBa0U7QUFBQSx3QkFDakVrTSxNQUFNQyxhQUFhRCxNQUFNRSxrQkFDeEIsdUJBQUMsVUFBSyxXQUFVLGdHQUNiRixnQkFBTUUsa0JBRFQ7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFFQTtBQUFBLDJCQUxKO0FBQUE7QUFBQTtBQUFBO0FBQUEsNkJBT0E7QUFBQSxzQkFDQSx1QkFBQyxTQUFJLFdBQVUsa0RBQ2I7QUFBQSwrQ0FBQyxTQUFJLFdBQVUsMkJBQ2I7QUFBQSxpREFBQyxnQkFBYSxNQUFNLElBQUksV0FBVSxnQkFBbEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQ0FBOEM7QUFBQSwwQkFDN0M5TyxtQkFBbUI0TyxNQUFNekUsU0FBUztBQUFBLDBCQUFFO0FBQUEsMEJBQUV5RSxNQUFNeEUsV0FBV3dFLE1BQU14RSxZQUFZd0UsTUFBTXpFLFlBQVksS0FBS25LLG1CQUFtQjRPLE1BQU14RSxPQUFPLENBQUMsS0FBSztBQUFBLDZCQUZ6STtBQUFBO0FBQUE7QUFBQTtBQUFBLCtCQUdBO0FBQUEsd0JBQ0EsdUJBQUMsVUFBSyxXQUFVLCtDQUNid0U7QUFBQUEsZ0NBQU1YO0FBQUFBLDBCQUFVO0FBQUEsMEJBQUMsdUJBQUMsVUFBSyxXQUFVLHNEQUFzRFcsZ0JBQU1YLGNBQWMsSUFBSSxRQUFRLFVBQXRHO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUNBQTZHO0FBQUEsNkJBRGpJO0FBQUE7QUFBQTtBQUFBO0FBQUEsK0JBRUE7QUFBQSwyQkFQRjtBQUFBO0FBQUE7QUFBQTtBQUFBLDZCQVFBO0FBQUEseUJBakJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsMkJBa0JBO0FBQUEsdUJBdkJGO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBd0JBO0FBQUEsa0JBRUEsdUJBQUMsU0FBSSxXQUFVLDJCQUNiO0FBQUEsMkNBQUMsU0FBSSxXQUFVLHNDQUNaekM7QUFBQUEscUNBQWVvRCxNQUFNbkQsTUFBTTtBQUFBLHVCQUMxQm1ELE1BQU1HLGNBQWNILE1BQU1JLGNBQWNKLE1BQU1LLGdCQUM5Qyx1QkFBQyxVQUFLLFdBQVUsd0ZBQ2I5TyxnQkFBTXlPLE1BQU1HLGNBQWNILE1BQU1JLGNBQWNKLE1BQU1LLFdBQVcsRUFBRXhDLE9BQU8sa0JBQWtCLEtBRDdGO0FBQUE7QUFBQTtBQUFBO0FBQUEsNkJBRUE7QUFBQSx5QkFMSjtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQU9BO0FBQUEsb0JBQ0NsSSx1QkFBdUJxSyxNQUFNbkQsUUFBUUUsWUFBWSxNQUFNLGFBQ3REO0FBQUEsc0JBQUM7QUFBQTtBQUFBLHdCQUNDLFNBQVMsQ0FBQzNELE1BQU07QUFDZEEsNEJBQUVrSCxnQkFBZ0I7QUFDbEJ4TCw4Q0FBb0JrTCxNQUFNaE0sR0FBRztBQUFBLHdCQUMvQjtBQUFBLHdCQUNBLFdBQVU7QUFBQSx3QkFDVixPQUFNO0FBQUEsd0JBRU4saUNBQUMsV0FBUSxNQUFNLE1BQWY7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFBa0I7QUFBQTtBQUFBLHNCQVJwQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsb0JBU0E7QUFBQSxvQkFFRDBCLHFCQUFxQnNLLE1BQU1uRCxXQUFXLGNBQWN0TCxNQUFNLEVBQUVnUCxTQUFTaFAsTUFBTXlPLE1BQU14RSxPQUFPLEVBQUVnRixNQUFNLEtBQUssQ0FBQyxLQUNwRztBQUFBLHNCQUFDO0FBQUE7QUFBQSx3QkFDQyxTQUFTLENBQUNwSCxNQUFNO0FBQ2RBLDRCQUFFa0gsZ0JBQWdCO0FBQ2xCakosOENBQW9CLEVBQUVDLFFBQVEsTUFBTUMsU0FBU3lJLE1BQU1oTSxLQUFLd0QsV0FBV3dJLE9BQU92SSxZQUFZbEcsTUFBTSxFQUFFc00sT0FBTyxZQUFZLEVBQUUsQ0FBQztBQUFBLHdCQUN0SDtBQUFBLHdCQUNBLFdBQVU7QUFBQSx3QkFDVixPQUFNO0FBQUEsd0JBRU4saUNBQUMsV0FBUSxNQUFNLE1BQWY7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFBa0I7QUFBQTtBQUFBLHNCQVJwQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsb0JBU0E7QUFBQSx1QkEvQkw7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFpQ0E7QUFBQSxxQkE1RFFpQixHQUFWO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBNkRBO0FBQUEsY0FDRCxJQUVELHVCQUFDLFNBQUksV0FBVSw2R0FDYixpQ0FBQyxTQUFNLE9BQU94TixNQUFNbVAsd0JBQXdCLGFBQWEsdUJBQUMsVUFBSyxXQUFVLHNDQUFxQyxnQ0FBckQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBcUUsS0FBOUg7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBc0ksS0FEeEk7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFFQSxLQTFFSjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQTRFQTtBQUFBLGlCQWxGRjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQW1GQTtBQUFBLGVBdEdGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBdUdBO0FBQUEsVUFHRDNJLGlCQUFpQixnQkFBZ0JFLGNBQWM2SCxXQUM5Qyx1QkFBQyxTQUFJLFdBQVUsNERBQ1p2SCwwQkFDQyx1QkFBQyxTQUFJLFdBQVUsc0RBQXFELDBCQUFwRTtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUE4RSxJQUU5RSx1QkFBQyxTQUFJLFdBQVUsc0RBRWI7QUFBQSxtQ0FBQyxTQUFJLFdBQVUsMkJBRWI7QUFBQSxxQ0FBQyxTQUFJLFdBQVUsdUVBQ2I7QUFBQSx1Q0FBQyxRQUFHLFdBQVUsNEZBQ1o7QUFBQSx5Q0FBQyxRQUFLLE1BQU0sSUFBSSxXQUFVLHFCQUExQjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUEyQztBQUFBLGtCQUFFO0FBQUEscUJBRC9DO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBRUE7QUFBQSxnQkFDQSx1QkFBQyxTQUFJLFdBQVUsNkVBQ2I7QUFBQSx5Q0FBQyxTQUFJLFdBQVUsd0JBQ2I7QUFBQSwyQ0FBQyxVQUFLLFdBQVUsa0JBQWlCLGtDQUFqQztBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUFtRDtBQUFBLG9CQUNuRCx1QkFBQyxVQUFLLFdBQVUsOEJBQThCTix1QkFBYWxFLGFBQTNEO0FBQUE7QUFBQTtBQUFBO0FBQUEsMkJBQXFFO0FBQUEsdUJBRnZFO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBR0E7QUFBQSxrQkFDQSx1QkFBQyxTQUFJLFdBQVUsd0JBQ2I7QUFBQSwyQ0FBQyxVQUFLLFdBQVUsa0JBQWlCLHdDQUFqQztBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUF5RDtBQUFBLG9CQUN6RCx1QkFBQyxVQUFLLFdBQVUsOEJBQThCa0U7QUFBQUEsbUNBQWEwSTtBQUFBQSxzQkFBa0I7QUFBQSx5QkFBN0U7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFBa0Y7QUFBQSx1QkFGcEY7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFHQTtBQUFBLGtCQUNBLHVCQUFDLFNBQUksV0FBVSx3QkFDYjtBQUFBLDJDQUFDLFVBQUssV0FBVSxrQkFBaUIscUNBQWpDO0FBQUE7QUFBQTtBQUFBO0FBQUEsMkJBQXNEO0FBQUEsb0JBQ3RELHVCQUFDLFVBQUssV0FBVSw4QkFBOEIxSTtBQUFBQSxtQ0FBYTJJO0FBQUFBLHNCQUFpQjtBQUFBLHlCQUE1RTtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUFpRjtBQUFBLHVCQUZuRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUdBO0FBQUEsa0JBQ0EsdUJBQUMsU0FBSSxXQUFVLHdCQUNiO0FBQUEsMkNBQUMsVUFBSyxXQUFVLGtCQUFpQix1QkFBakM7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFBd0M7QUFBQSxvQkFDeEMsdUJBQUMsVUFBSyxXQUFVLDhCQUE4QjNJLHVCQUFhNEksV0FBM0Q7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFBbUU7QUFBQSx1QkFGckU7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFHQTtBQUFBLGtCQUNDNUksYUFBYTZJLFdBQ1osdUJBQUMsU0FBSSxXQUFVLGdFQUNiO0FBQUEsMkNBQUMsVUFBSyxXQUFVLGtCQUFpQix3QkFBakM7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFBeUM7QUFBQSxvQkFDekMsdUJBQUMsVUFBSyxXQUFVLDZCQUE2QjdJLHVCQUFhNkksV0FBMUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFBa0U7QUFBQSx1QkFGcEU7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFHQTtBQUFBLHFCQXJCSjtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQXVCQTtBQUFBLG1CQTNCRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQTRCQTtBQUFBLGNBR0EsdUJBQUMsU0FBSSxXQUFVLHVFQUNiO0FBQUEsdUNBQUMsUUFBRyxXQUFVLDRGQUNaO0FBQUEseUNBQUMsY0FBVyxNQUFNLElBQUksV0FBVSxxQkFBaEM7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBaUQ7QUFBQSxrQkFBRTtBQUFBLHFCQURyRDtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUVBO0FBQUEsaUJBRUUsTUFBTTtBQUNOLHdCQUFNQyxvQkFBb0J0TSxTQUFTNEIsS0FBSyxDQUFBdUksTUFBS0EsRUFBRTdLLGNBQWNrRSxhQUFhbEUsVUFBVWlOLFlBQVksQ0FBQztBQUNqRyx3QkFBTUMsZ0JBQWdCRixvQkFBcUJBLGtCQUFrQnZOLGFBQWEsSUFBSztBQUMvRSx3QkFBTTBOLFVBQVVuSCxTQUFTdEIsV0FBV0UsSUFBSSxLQUFLO0FBRTdDLHdCQUFNd0ksbUJBQW1CLE1BQU07QUFDN0Isd0JBQUlELFdBQVcsRUFBRyxRQUFPO0FBQ3pCLHdCQUFJQSxXQUFXakosY0FBYzBJLHFCQUFxQixJQUFJO0FBQ3BELDZCQUFPLDhCQUE4QjFJLGNBQWMwSSxpQkFBaUI7QUFBQSxvQkFDdEU7QUFDQSx3QkFBSU0sZ0JBQWdCQyxXQUFXakosY0FBYzJJLG9CQUFvQixJQUFJO0FBQ25FLDZCQUFPLDRCQUE0QjNJLGNBQWMySSxnQkFBZ0IsWUFBWTNJLGNBQWNsRSxTQUFTLHVCQUF1QmtOLGFBQWEsZUFBZUEsZ0JBQWdCQyxPQUFPO0FBQUEsb0JBQ2hMO0FBQ0EsMkJBQU87QUFBQSxrQkFDVCxHQUFHO0FBRUgsd0JBQU1FLGVBQWVGLFVBQVUsS0FBSy9JLGNBQWMsSUFDOUN4RSxLQUFLME4sTUFBT2xKLGNBQWMsS0FBTStJLE9BQU8sSUFDdkM7QUFFSix5QkFDRSx1QkFBQyxVQUFLLFVBQVV2SCxvQkFBb0IsV0FBVSxhQUM1QztBQUFBLDJDQUFDLFNBQUksV0FBVSxtR0FDYjtBQUFBLDZDQUFDLFVBQUssV0FBVSxrQkFBaUI7QUFBQTtBQUFBLHdCQUFNMUIsYUFBYWxFO0FBQUFBLHdCQUFVO0FBQUEsMkJBQTlEO0FBQUE7QUFBQTtBQUFBO0FBQUEsNkJBQXVFO0FBQUEsc0JBQ3ZFLHVCQUFDLFVBQUssV0FBVSwrQkFBK0JrTjtBQUFBQTtBQUFBQSx3QkFBYztBQUFBLDJCQUE3RDtBQUFBO0FBQUE7QUFBQTtBQUFBLDZCQUFrRTtBQUFBLHlCQUZwRTtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUdBO0FBQUEsb0JBRUEsdUJBQUMsU0FBSSxXQUFVLGFBQ2I7QUFBQSw2Q0FBQyxXQUFNLFdBQVUsaUVBQWdFLGdDQUFqRjtBQUFBO0FBQUE7QUFBQTtBQUFBLDZCQUFpRztBQUFBLHNCQUNqRztBQUFBLHdCQUFDO0FBQUE7QUFBQSwwQkFDQyxNQUFLO0FBQUEsMEJBQ0wsS0FBSTtBQUFBLDBCQUNKLEtBQUtoSixjQUFjMEkscUJBQXFCO0FBQUEsMEJBQ3hDLE9BQU9sSSxXQUFXRTtBQUFBQSwwQkFDbEIsVUFBVSxDQUFBVSxNQUFLWCxjQUFjLENBQUE0SSxVQUFTLEVBQUUsR0FBR0EsTUFBTTNJLE1BQU1VLEVBQUVrSSxPQUFPalAsTUFBTSxFQUFFO0FBQUEsMEJBQ3hFLGFBQWEsT0FBTzJGLGNBQWMwSSxxQkFBcUIsQ0FBQztBQUFBLDBCQUN4RCxXQUFVO0FBQUEsMEJBQ1YsVUFBUTtBQUFBO0FBQUEsd0JBUlY7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQVFVO0FBQUEseUJBVlo7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFZQTtBQUFBLG9CQUdDTyxVQUFVLEtBQ1QsdUJBQUMsU0FBSSxXQUFVLHNHQUNiO0FBQUEsNkNBQUMsU0FBSSxXQUFVLHFDQUNiO0FBQUEsK0NBQUMsVUFBSyxXQUFVLDBCQUF5QixpQ0FBekM7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFBMEQ7QUFBQSx3QkFDMUQsdUJBQUMsVUFBSyxXQUFVLHVDQUFzQztBQUFBO0FBQUEsMEJBQUVFLGFBQWFJLGVBQWU7QUFBQSw2QkFBcEY7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFBc0Y7QUFBQSwyQkFGeEY7QUFBQTtBQUFBO0FBQUE7QUFBQSw2QkFHQTtBQUFBLHNCQUNDckosY0FBYyxLQUNiLHVCQUFDLE9BQUUsV0FBVSx5REFBd0Q7QUFBQTtBQUFBLHdCQUNwREEsWUFBWXFKLGVBQWU7QUFBQSx3QkFBRTtBQUFBLHdCQUFpQk47QUFBQUEsd0JBQVE7QUFBQSx3QkFBVUUsYUFBYUksZUFBZTtBQUFBLDJCQUQ3RztBQUFBO0FBQUE7QUFBQTtBQUFBLDZCQUVBO0FBQUEsc0JBRUYsdUJBQUMsT0FBRSxXQUFVLHFDQUFvQyxpRUFBakQ7QUFBQTtBQUFBO0FBQUE7QUFBQSw2QkFBa0c7QUFBQSx5QkFWcEc7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFXQTtBQUFBLG9CQUdETCxtQkFDQyx1QkFBQyxTQUFJLFdBQVUsbUhBQ2I7QUFBQSw2Q0FBQyxlQUFZLE1BQU0sSUFBSSxXQUFVLDBCQUFqQztBQUFBO0FBQUE7QUFBQTtBQUFBLDZCQUF1RDtBQUFBLHNCQUN2RCx1QkFBQyxVQUFNQSw2QkFBUDtBQUFBO0FBQUE7QUFBQTtBQUFBLDZCQUF1QjtBQUFBLHlCQUZ6QjtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUdBO0FBQUEsb0JBR0YsdUJBQUMsU0FBSSxXQUFVLGFBQ2I7QUFBQSw2Q0FBQyxXQUFNLFdBQVUsaUVBQWdFLGlDQUFqRjtBQUFBO0FBQUE7QUFBQTtBQUFBLDZCQUFrRztBQUFBLHNCQUNsRztBQUFBLHdCQUFDO0FBQUE7QUFBQSwwQkFDQyxNQUFNO0FBQUEsMEJBQ04sT0FBTzFJLFdBQVdHO0FBQUFBLDBCQUNsQixVQUFVLENBQUFTLE1BQUtYLGNBQWMsQ0FBQTRJLFVBQVMsRUFBRSxHQUFHQSxNQUFNMUksUUFBUVMsRUFBRWtJLE9BQU9qUCxNQUFNLEVBQUU7QUFBQSwwQkFDMUUsYUFBWTtBQUFBLDBCQUNaLFdBQVU7QUFBQTtBQUFBLHdCQUxaO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFLb0s7QUFBQSx5QkFQdEs7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFTQTtBQUFBLG9CQUVBO0FBQUEsc0JBQUM7QUFBQTtBQUFBLHdCQUNDLE1BQUs7QUFBQSx3QkFDTCxVQUFVdUcsb0JBQW9CLENBQUMsQ0FBQ3NJLG1CQUFtQkQsV0FBVztBQUFBLHdCQUM5RCxXQUFVO0FBQUEsd0JBRVRySSw2QkFBbUIsa0JBQWtCO0FBQUE7QUFBQSxzQkFMeEM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLG9CQU1BO0FBQUEsdUJBNURGO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBNkRBO0FBQUEsZ0JBRUosR0FBRztBQUFBLG1CQXpGTDtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQTBGQTtBQUFBLGlCQTNIRjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQTRIQTtBQUFBLFlBR0EsdUJBQUMsU0FBSSxXQUFVLGlCQUNiLGlDQUFDLFNBQUksV0FBVSx1RUFDYjtBQUFBLHFDQUFDLFFBQUcsV0FBVSw0RkFDWjtBQUFBLHVDQUFDLFdBQVEsTUFBTSxJQUFJLFdBQVUscUJBQTdCO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQThDO0FBQUEsZ0JBQUU7QUFBQSxtQkFEbEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFFQTtBQUFBLGNBQ0NSLGVBQWVqQixXQUFXLElBQ3pCLHVCQUFDLFNBQUksV0FBVSxrRUFDYjtBQUFBLHVDQUFDLFVBQUssV0FBVSxpQkFBZ0Isa0JBQWhDO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQWtDO0FBQUEsZ0JBQ2xDLHVCQUFDLE9BQUUsV0FBVSw2REFBNEQsMENBQXpFO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQW1HO0FBQUEsbUJBRnJHO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBR0EsSUFFQSx1QkFBQyxTQUFJLFdBQVUsYUFDWmlCLHlCQUFlbkYsSUFBSSxDQUFBdU8sUUFBTztBQUN6QixzQkFBTUMsY0FBYztBQUFBLGtCQUNsQkMsU0FBUztBQUFBLGtCQUNUQyxVQUFVO0FBQUEsa0JBQ1ZDLFVBQVU7QUFBQSxrQkFDVkMsV0FBVztBQUFBLGdCQUNiLEVBQUVMLElBQUkzRSxNQUFNLEtBQUs7QUFDakIsdUJBQ0UsdUJBQUMsU0FBa0IsV0FBVSx3SEFDM0I7QUFBQSx5Q0FBQyxTQUFJLFdBQVUsOEJBQ2I7QUFBQSwyQ0FBQyxTQUFJLFdBQVUscUNBQ2I7QUFBQSw2Q0FBQyxVQUFLLFdBQVUseUNBQXlDMkU7QUFBQUEsNEJBQUkzSDtBQUFBQSx3QkFBYztBQUFBLHdCQUFRMkgsSUFBSTFOO0FBQUFBLHdCQUFVO0FBQUEsMkJBQWpHO0FBQUE7QUFBQTtBQUFBO0FBQUEsNkJBQWtHO0FBQUEsc0JBQ2xHLHVCQUFDLFVBQUssV0FBV3RDLEtBQUssOERBQThEaVEsV0FBVyxHQUM1RkQsY0FBSTNFLFVBRFA7QUFBQTtBQUFBO0FBQUE7QUFBQSw2QkFFQTtBQUFBLHlCQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsMkJBS0E7QUFBQSxvQkFDQSx1QkFBQyxTQUFJLFdBQVUsK0RBQ2I7QUFBQSw2Q0FBQyxTQUFJO0FBQUE7QUFBQSx3QkFBVyx1QkFBQyxVQUFLLFdBQVUsNEJBQTRCMkU7QUFBQUEsOEJBQUlNO0FBQUFBLDBCQUFpQjtBQUFBLDZCQUFqRTtBQUFBO0FBQUE7QUFBQTtBQUFBLCtCQUFzRTtBQUFBLDJCQUF0RjtBQUFBO0FBQUE7QUFBQTtBQUFBLDZCQUE2RjtBQUFBLHNCQUM3Rix1QkFBQyxTQUFJO0FBQUE7QUFBQSx3QkFBUSx1QkFBQyxVQUFLLFdBQVUsOEJBQTZCO0FBQUE7QUFBQSwyQkFBR04sSUFBSUwsZ0JBQWdCLEdBQUdJLGVBQWU7QUFBQSw2QkFBdEY7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFBd0Y7QUFBQSwyQkFBckc7QUFBQTtBQUFBO0FBQUE7QUFBQSw2QkFBNEc7QUFBQSxzQkFDM0dDLElBQUk3SSxVQUFVLHVCQUFDLFNBQUksV0FBVSxvREFBbUQ7QUFBQTtBQUFBLHdCQUFVNkksSUFBSTdJO0FBQUFBLHdCQUFPO0FBQUEsMkJBQXZGO0FBQUE7QUFBQTtBQUFBO0FBQUEsNkJBQXdGO0FBQUEsc0JBQ3RHNkksSUFBSU8sZUFBZSx1QkFBQyxTQUFJLFdBQVUsbURBQWtEO0FBQUE7QUFBQSx3QkFBYVAsSUFBSU87QUFBQUEsd0JBQVk7QUFBQSwyQkFBOUY7QUFBQTtBQUFBO0FBQUE7QUFBQSw2QkFBK0Y7QUFBQSx5QkFKckg7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFLQTtBQUFBLG9CQUNBLHVCQUFDLFNBQUksV0FBVSwwQ0FBeUM7QUFBQTtBQUFBLHNCQUN2Q3hRLE1BQU1pUSxJQUFJUSxTQUFTLEVBQUVuRSxPQUFPLGtCQUFrQjtBQUFBLHlCQUQvRDtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUVBO0FBQUEsdUJBZkY7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFnQkE7QUFBQSxrQkFDQzJELElBQUkzRSxXQUFXLGFBQ2Q7QUFBQSxvQkFBQztBQUFBO0FBQUEsc0JBQ0MsU0FBUyxNQUFNM0MsbUJBQW1Cc0gsSUFBSXhOLEdBQUc7QUFBQSxzQkFDekMsVUFBVThFLHFCQUFxQjBJLElBQUl4TjtBQUFBQSxzQkFDbkMsV0FBVTtBQUFBLHNCQUVUOEUsK0JBQXFCMEksSUFBSXhOLE1BQU0sUUFBUTtBQUFBO0FBQUEsb0JBTDFDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxrQkFNQTtBQUFBLHFCQXpCTXdOLElBQUl4TixLQUFkO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBMkJBO0FBQUEsY0FFSixDQUFDLEtBdENIO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBdUNBO0FBQUEsaUJBakRKO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBbURBLEtBcERGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBcURBO0FBQUEsZUF0TEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkF1TEEsS0EzTEo7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkE2TEE7QUFBQSxhQXpiRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBMmJBO0FBQUEsUUFHRDJDLGNBQWMsY0FDYix1QkFBQyxTQUFJLFdBQVUscUdBRVpsQjtBQUFBQSxpQ0FDQyx1QkFBQyxTQUFJLFdBQVUsaUJBQ2I7QUFBQSxtQ0FBQyxrQkFBZSxPQUFNLG9CQUF0QjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUFzQztBQUFBLFlBQ3RDLHVCQUFDLFNBQUksV0FBVSw2REFDYixpQ0FBQyxVQUFLLFVBQVU0RyxxQkFBcUIsV0FBVSxhQUM3QztBQUFBLHFDQUFDLFNBQUksV0FBVSwwQkFDYjtBQUFBLHVDQUFDLFNBQUksV0FBVSxlQUNiO0FBQUEseUNBQUMsV0FBTSxXQUFVLHNDQUFxQyw2QkFBdEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBbUU7QUFBQSxrQkFDbkU7QUFBQSxvQkFBQztBQUFBO0FBQUEsc0JBQ0MsTUFBSztBQUFBLHNCQUNMO0FBQUEsc0JBQ0EsS0FBSzlLLE1BQU0sRUFBRXNNLE9BQU8sWUFBWTtBQUFBLHNCQUNoQyxXQUFVO0FBQUEsc0JBQ1YsT0FBT3hDLFlBQVlFO0FBQUFBLHNCQUNuQixVQUFVLENBQUFuQyxNQUFLa0MsZUFBZSxFQUFFLEdBQUdELGFBQWFFLFdBQVduQyxFQUFFa0ksT0FBT2pQLE1BQU0sQ0FBQztBQUFBO0FBQUEsb0JBTjdFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxrQkFNK0U7QUFBQSxxQkFSakY7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFVQTtBQUFBLGdCQUNBLHVCQUFDLFNBQUksV0FBVSxlQUNiO0FBQUEseUNBQUMsV0FBTSxXQUFVLHNDQUFxQyx3QkFBdEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBOEQ7QUFBQSxrQkFDOUQsdUJBQUMsU0FBSSxXQUFVLHVKQUFzSiw4QkFBcks7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBbUw7QUFBQSxxQkFGckw7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFHQTtBQUFBLG1CQWZGO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBZ0JBO0FBQUEsY0FFQSx1QkFBQyxTQUFJLFdBQVUsMEJBQ2I7QUFBQSx1Q0FBQyxTQUFJLFdBQVUsZUFDYjtBQUFBLHlDQUFDLFdBQU0sV0FBVSxzQ0FBcUMsd0JBQXREO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQThEO0FBQUEsa0JBQzlEO0FBQUEsb0JBQUM7QUFBQTtBQUFBLHNCQUNDLE1BQUs7QUFBQSxzQkFDTCxXQUFVO0FBQUEsc0JBQ1YsT0FBT2dKLFlBQVlJO0FBQUFBLHNCQUNuQixVQUFVLENBQUFyQyxNQUFLa0MsZUFBZSxFQUFFLEdBQUdELGFBQWFJLFNBQVNyQyxFQUFFa0ksT0FBT2pQLE1BQU0sQ0FBQztBQUFBO0FBQUEsb0JBSjNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxrQkFJNkU7QUFBQSxxQkFOL0U7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFRQTtBQUFBLGdCQUNBLHVCQUFDLFNBQUksV0FBVSxlQUNiO0FBQUEseUNBQUMsV0FBTSxXQUFVLHNDQUFxQyx5QkFBdEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBK0Q7QUFBQSxrQkFDL0Q7QUFBQSxvQkFBQztBQUFBO0FBQUEsc0JBQ0MsTUFBSztBQUFBLHNCQUNMLFdBQVU7QUFBQSxzQkFDVixPQUFPZ0osWUFBWUs7QUFBQUEsc0JBQ25CLFVBQVUsQ0FBQXRDLE1BQUtrQyxlQUFlLEVBQUUsR0FBR0QsYUFBYUssVUFBVXRDLEVBQUVrSSxPQUFPalAsTUFBTSxDQUFDO0FBQUE7QUFBQSxvQkFKNUU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGtCQUk4RTtBQUFBLHFCQU5oRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQVFBO0FBQUEsbUJBbEJGO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBbUJBO0FBQUEsY0FFQSx1QkFBQyxTQUFJLFdBQVUsZUFDYjtBQUFBLHVDQUFDLFdBQU0sV0FBVSxzQ0FBcUMsc0NBQXREO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQTRFO0FBQUEsZ0JBQzVFO0FBQUEsa0JBQUM7QUFBQTtBQUFBLG9CQUNDO0FBQUEsb0JBQ0EsYUFBWTtBQUFBLG9CQUNaLFdBQVU7QUFBQSxvQkFDVixPQUFPZ0osWUFBWTFDO0FBQUFBLG9CQUNuQixVQUFVLENBQUFTLE1BQUtrQyxlQUFlLEVBQUUsR0FBR0QsYUFBYTFDLFFBQVFTLEVBQUVrSSxPQUFPalAsTUFBTSxDQUFDO0FBQUE7QUFBQSxrQkFMMUU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGdCQUs0RTtBQUFBLG1CQVA5RTtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQVNBO0FBQUEsY0FFQSx1QkFBQyxTQUFJLFdBQVUsUUFDYjtBQUFBLGdCQUFDO0FBQUE7QUFBQSxrQkFDQyxNQUFLO0FBQUEsa0JBQ0wsVUFBVXNKO0FBQUFBLGtCQUNWLFdBQVU7QUFBQSxrQkFFVEEsOEJBQ0MsdUJBQUMsU0FBSSxXQUFVLCtFQUFmO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQTJGLElBRTNGLG1DQUNFO0FBQUEsMkNBQUMsUUFBSyxNQUFNLE1BQVo7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFBZTtBQUFBLG9CQUNmLHVCQUFDLFVBQUssaUNBQU47QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFBdUI7QUFBQSx1QkFGekI7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFHQTtBQUFBO0FBQUEsZ0JBWEo7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGNBYUEsS0FkRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQWVBO0FBQUEsaUJBbEVGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBbUVBLEtBcEVGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBcUVBO0FBQUEsZUF2RUY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkF3RUE7QUFBQSxVQUlGLHVCQUFDLFNBQUksV0FBV25LLEtBQUssaUJBQWlCLENBQUNpRSx1QkFBdUIsZ0JBQWdCLEdBQzVFO0FBQUEsbUNBQUMsU0FBSSxXQUFVLDBDQUNiO0FBQUEscUNBQUMsa0JBQWUsT0FBTSxvQkFBdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBc0M7QUFBQSxjQUN0Qyx1QkFBQyxVQUFLLFdBQVUsMEVBQTBFZ0U7QUFBQUEseUJBQVN0QztBQUFBQSxnQkFBTztBQUFBLG1CQUExRztBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUFnSDtBQUFBLGlCQUZsSDtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUdBO0FBQUEsWUFFQSx1QkFBQyxTQUFJLFdBQVUsYUFDWixXQUFDckIsdUJBQ0EsdUJBQUMsU0FBSSxXQUFVLHVIQUNiO0FBQUEscUNBQUMsV0FBUSxNQUFNLElBQUksV0FBVSx5QkFBN0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBa0Q7QUFBQSxjQUNsRCx1QkFBQyxVQUFLLFdBQVUsaUNBQWdDLGdEQUFoRDtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUFnRjtBQUFBLGlCQUZsRjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUdBLElBQ0UyRCxTQUFTdEMsU0FBUyxJQUNwQnNDLFNBQVN4RztBQUFBQSxjQUFJLENBQUN1TyxLQUFLMUMsTUFDakIsdUJBQUMsU0FBWSxXQUFVLDJJQUNyQjtBQUFBLHVDQUFDLFNBQUksV0FBVSwyQkFDYjtBQUFBLHlDQUFDLFNBQUksV0FBVSxxSEFDYjtBQUFBLDJDQUFDLFVBQUssV0FBVSxrRkFBa0Z2TixnQkFBTWlRLElBQUlqRyxTQUFTLEVBQUVzQyxPQUFPLEtBQUssS0FBbkk7QUFBQTtBQUFBO0FBQUE7QUFBQSwyQkFBcUk7QUFBQSxvQkFDckksdUJBQUMsVUFBSyxXQUFVLDBDQUEwQ3RNLGdCQUFNaVEsSUFBSWpHLFNBQVMsRUFBRXNDLE9BQU8sSUFBSSxLQUExRjtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUE0RjtBQUFBLHVCQUY5RjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUdBO0FBQUEsa0JBQ0EsdUJBQUMsU0FDQztBQUFBLDJDQUFDLFFBQUcsV0FBVSwyQ0FBMkN6TSw2QkFBbUJvUSxJQUFJakcsU0FBUyxLQUF6RjtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUEyRjtBQUFBLG9CQUMzRix1QkFBQyxPQUFFLFdBQVUsaUVBQWdFO0FBQUE7QUFBQSxzQkFBRWlHLElBQUk3STtBQUFBQSxzQkFBTztBQUFBLHlCQUExRjtBQUFBO0FBQUE7QUFBQTtBQUFBLDJCQUEyRjtBQUFBLHVCQUY3RjtBQUFBO0FBQUE7QUFBQTtBQUFBLHlCQUdBO0FBQUEscUJBUkY7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFTQTtBQUFBLGdCQUNBLHVCQUFDLFNBQUksV0FBVSxZQUNaaUUseUJBQWU0RSxJQUFJM0UsTUFBTSxLQUQ1QjtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUVBO0FBQUEsbUJBYlFpQyxHQUFWO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBY0E7QUFBQSxZQUNELElBRUQsdUJBQUMsU0FBSSxXQUFVLHVIQUNiO0FBQUEscUNBQUMsV0FBUSxNQUFNLElBQUksV0FBVSx5QkFBN0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBa0Q7QUFBQSxjQUNsRCx1QkFBQyxVQUFLLFdBQVUsaUNBQWdDLDBCQUFoRDtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUEwRDtBQUFBLGlCQUY1RDtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUdBLEtBNUJKO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBOEJBO0FBQUEsZUFwQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFxQ0E7QUFBQSxhQXBIRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBcUhBO0FBQUEsV0F2b0JKO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUF5b0JBO0FBQUEsU0F6cUJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0EwcUJBO0FBQUEsSUFHQzFILGlCQUFpQkUsVUFDaEIsdUJBQUMsU0FBSSxXQUFVLDRIQUNiLGlDQUFDLFNBQUksV0FBVSxzR0FDYjtBQUFBLDZCQUFDLFNBQUksV0FBVSx5RUFDYjtBQUFBLCtCQUFDLFFBQUcsV0FBVSxtREFBa0QsMkNBQWhFO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFBMkY7QUFBQSxRQUMzRix1QkFBQyxZQUFPLFNBQVMsTUFBTUQsb0JBQW9CLEVBQUVDLFFBQVEsT0FBT0MsU0FBUyxNQUFNQyxXQUFXLE1BQU1DLFlBQVksR0FBRyxDQUFDLEdBQUcsV0FBVSx3RkFDdkgsaUNBQUMsV0FBUSxNQUFNLE1BQWY7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUFrQixLQURwQjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBRUE7QUFBQSxXQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFLQTtBQUFBLE1BQ0EsdUJBQUMsU0FBSSxXQUFVLGlCQUNiO0FBQUEsK0JBQUMsU0FBSSxXQUFVLDZFQUNiO0FBQUEsaUNBQUMsUUFBSyxNQUFNLElBQUksV0FBVSxvQ0FBMUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBMEQ7QUFBQSxVQUMxRCx1QkFBQyxPQUFFLFdBQVUsc0RBQXFEO0FBQUE7QUFBQSxZQUVoRSx1QkFBQyxVQUFEO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQUc7QUFBQSxZQUFFLHVCQUFDLFVBQUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBRztBQUFBLFlBQ1IsdUJBQUMsVUFBSyxXQUFVLGFBQVksMkdBQTVCO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQXVIO0FBQUEsZUFIekg7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFJQTtBQUFBLGFBTkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQU9BO0FBQUEsUUFDQSx1QkFBQyxTQUFJLFdBQVUsZUFDYjtBQUFBLGlDQUFDLFdBQU0sV0FBVSw4REFBNkQsNEJBQTlFO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBQTBGO0FBQUEsVUFDMUY7QUFBQSxZQUFDO0FBQUE7QUFBQSxjQUNDLE1BQUs7QUFBQSxjQUNMLEtBQUtsRyxNQUFNNkYsaUJBQWlCSSxVQUFVK0QsU0FBUyxFQUFFc0MsT0FBTyxZQUFZO0FBQUEsY0FDcEUsS0FBS3RNLE1BQU02RixpQkFBaUJJLFVBQVVnRSxPQUFPLEVBQUVxQyxPQUFPLFlBQVk7QUFBQSxjQUNsRSxXQUFVO0FBQUEsY0FDVixPQUFPekcsaUJBQWlCSztBQUFBQSxjQUN4QixVQUFVLENBQUMyQixNQUFNL0Isb0JBQW9CLEVBQUUsR0FBR0Qsa0JBQWtCSyxZQUFZMkIsRUFBRWtJLE9BQU9qUCxNQUFNLENBQUM7QUFBQTtBQUFBLFlBTjFGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxVQU00RjtBQUFBLGFBUjlGO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFVQTtBQUFBLFdBbkJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFvQkE7QUFBQSxNQUNBLHVCQUFDLFNBQUksV0FBVSxpRkFDYjtBQUFBO0FBQUEsVUFBQztBQUFBO0FBQUEsWUFDQyxTQUFTLFlBQVk7QUFDbEIsa0JBQUk7QUFDRndGLG9DQUFvQixJQUFJO0FBQ3hCLHNCQUFNb0ssaUJBQWlCMVEsTUFBTTZGLGlCQUFpQkksVUFBVStELFNBQVMsRUFBRTJHLFNBQVMsR0FBRyxLQUFLLEVBQUVyRSxPQUFPLFlBQVk7QUFDekcsc0JBQU03TSxJQUFJNEksS0FBSyxpQ0FBaUN4QyxpQkFBaUJHLE9BQU8sSUFBSSxFQUFFRSxZQUFZd0ssZUFBZSxDQUFDO0FBQzFHNUssb0NBQW9CLEVBQUVDLFFBQVEsT0FBT0MsU0FBUyxNQUFNQyxXQUFXLE1BQU1DLFlBQVksR0FBRyxDQUFDO0FBQ3JGNUMsbUNBQW1CO0FBQUEsY0FDckIsUUFBUTtBQUNOa0Ysc0JBQU0sOEJBQThCO0FBQUEsY0FDdEMsVUFBQztBQUNDbEMsb0NBQW9CLEtBQUs7QUFBQSxjQUMzQjtBQUFBLFlBQ0g7QUFBQSxZQUNBLFVBQVVEO0FBQUFBLFlBQ1YsV0FBVTtBQUFBLFlBQWdKO0FBQUE7QUFBQSxVQWY1SjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFrQkE7QUFBQSxRQUNBLHVCQUFDLFlBQU8sU0FBUyxNQUFNUCxvQkFBb0IsRUFBRUMsUUFBUSxPQUFPQyxTQUFTLE1BQU1DLFdBQVcsTUFBTUMsWUFBWSxHQUFHLENBQUMsR0FBRyxXQUFVLDZGQUE0RixzQkFBck47QUFBQTtBQUFBO0FBQUE7QUFBQSxlQUEyTjtBQUFBLFFBQzNOO0FBQUEsVUFBQztBQUFBO0FBQUEsWUFDQyxTQUFTMkM7QUFBQUEsWUFDVCxVQUFVeEMsb0JBQW9CLENBQUNSLGlCQUFpQks7QUFBQUEsWUFDaEQsV0FBVTtBQUFBLFlBRVRHO0FBQUFBLGlDQUFtQix1QkFBQyxTQUFJLFdBQVUsK0VBQWY7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBMEYsSUFBTSx1QkFBQyxlQUFZLE1BQU0sTUFBbkI7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBc0I7QUFBQSxjQUFJO0FBQUE7QUFBQTtBQUFBLFVBTGhKO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQU9BO0FBQUEsV0E1QkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQTZCQTtBQUFBLFNBekRGO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0EwREEsS0EzREY7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQTREQTtBQUFBLElBSURGLGlCQUFpQjlIO0FBQUFBLE1BQ2hCLHVCQUFDLFNBQUksV0FBVSx3SEFDYixpQ0FBQyxTQUFJLFdBQVUseUpBRWI7QUFBQSwrQkFBQyxTQUFJLFdBQVUseUdBQ2I7QUFBQSxpQ0FBQyxTQUNDO0FBQUEsbUNBQUMsUUFBRyxXQUFVLHdGQUNaO0FBQUEscUNBQUMsWUFBUyxNQUFNLElBQUksV0FBVSxxQkFBOUI7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBK0M7QUFBQSxjQUFHO0FBQUEsaUJBRHBEO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBR0E7QUFBQSxZQUNBLHVCQUFDLE9BQUUsV0FBVSx5RUFBd0U7QUFBQTtBQUFBLGNBQzlFOEgsY0FBYzFELEtBQUttTyxNQUFNLEVBQUUsRUFBRXBCLFlBQVk7QUFBQSxpQkFEaEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFFQTtBQUFBLGVBUEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFRQTtBQUFBLFVBQ0E7QUFBQSxZQUFDO0FBQUE7QUFBQSxjQUNDLFNBQVMsTUFBTXBKLGlCQUFpQixJQUFJO0FBQUEsY0FDcEMsV0FBVTtBQUFBLGNBRVYsaUNBQUMsV0FBUSxNQUFNLE1BQWY7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBa0I7QUFBQTtBQUFBLFlBSnBCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxVQUtBO0FBQUEsYUFmRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBZ0JBO0FBQUEsUUFHQSx1QkFBQyxTQUFJLFdBQVUsMkRBRWI7QUFBQSxpQ0FBQyxTQUFJLFdBQVUsaUZBQ2I7QUFBQSxtQ0FBQyxTQUNDO0FBQUEscUNBQUMsVUFBSyxXQUFVLDRFQUEyRSw4QkFBM0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBeUc7QUFBQSxjQUN6Ryx1QkFBQyxVQUFLLFdBQVUsZ0dBQWdHRCx3QkFBYzVELGFBQTlIO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQXdJO0FBQUEsaUJBRjFJO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBR0E7QUFBQSxZQUNBLHVCQUFDLFNBQ0M7QUFBQSxxQ0FBQyxVQUFLLFdBQVUsNEVBQTJFLDhCQUEzRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUF5RztBQUFBLGNBQ3hHOEksZUFBZWxGLGNBQWNtRixRQUFRbkYsY0FBYzBLLElBQUk7QUFBQSxpQkFGMUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFHQTtBQUFBLGVBUkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFTQTtBQUFBLFVBR0EsdUJBQUMsU0FBSSxXQUFVLGFBQ2I7QUFBQSxtQ0FBQyxVQUFLLFdBQVUsdUVBQXNFLGdDQUF0RjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUFzRztBQUFBLFlBQ3RHLHVCQUFDLFNBQUksV0FBVSwyRkFDYjtBQUFBLHFDQUFDLFNBQUksV0FBVSwyQkFDYjtBQUFBLHVDQUFDLFNBQUksV0FBVSx5RkFDYixpQ0FBQyxnQkFBYSxNQUFNLE1BQXBCO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQXVCLEtBRHpCO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBRUE7QUFBQSxnQkFDQSx1QkFBQyxTQUNDO0FBQUEseUNBQUMsU0FBSSxXQUFVLG9DQUNaaFI7QUFBQUEsdUNBQW1Cc0csY0FBYzZELFNBQVM7QUFBQSxvQkFBRTtBQUFBLG9CQUFFN0QsY0FBYzhELFdBQVc5RCxjQUFjOEQsWUFBWTlELGNBQWM2RCxZQUFZLEtBQUtuSyxtQkFBbUJzRyxjQUFjOEQsT0FBTyxDQUFDLEtBQUs7QUFBQSx1QkFEakw7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFFQTtBQUFBLGtCQUNBLHVCQUFDLFNBQUksV0FBVSxpREFBZ0Q7QUFBQTtBQUFBLG9CQUNqRDlELGNBQWNzSyxZQUFZelEsTUFBTW1HLGNBQWNzSyxTQUFTLEVBQUVuRSxPQUFPLGtCQUFrQixJQUFJO0FBQUEsdUJBRHBHO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBRUE7QUFBQSxxQkFORjtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQU9BO0FBQUEsbUJBWEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFZQTtBQUFBLGNBQ0EsdUJBQUMsU0FBSSxXQUFVLGNBQ2I7QUFBQSx1Q0FBQyxVQUFLLFdBQVUseUNBQ2JuRztBQUFBQSxnQ0FBYzJIO0FBQUFBLGtCQUFVO0FBQUEsa0JBQUUzSCxjQUFjMkgsY0FBYyxJQUFJLFFBQVE7QUFBQSxxQkFEckU7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFFQTtBQUFBLGdCQUNDM0gsY0FBY3VJLGFBQ2IsdUJBQUMsVUFBSyxXQUFVLG1JQUNaLGlCQUFNO0FBQ04sd0JBQU1vQyxTQUFTM0ssY0FBYzBLLE1BQU1FO0FBQ25DLHNCQUFJRCxVQUFVM0ssY0FBYzZELGNBQWM3RCxjQUFjOEQsU0FBUztBQUMvRCx3QkFBSTZHLE9BQU9FLGdCQUFnQkYsT0FBT0csWUFBYSxRQUFPO0FBQ3RELHdCQUFJSCxPQUFPRSxhQUFjLFFBQU8sZ0JBQWdCRixPQUFPSSxnQkFBZ0JDLE1BQU0sR0FBRyxFQUFFLENBQUMsQ0FBQztBQUNwRix3QkFBSUwsT0FBT0csWUFBYSxRQUFPLGVBQWVILE9BQU9NLGVBQWVELE1BQU0sR0FBRyxFQUFFLENBQUMsQ0FBQztBQUFBLGtCQUNuRjtBQUNBLHlCQUFPaEwsY0FBY3dJLGtCQUFrQjtBQUFBLGdCQUN6QyxHQUFHLEtBVEw7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFVQTtBQUFBLG1CQWZKO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBaUJBO0FBQUEsaUJBL0JGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBZ0NBO0FBQUEsZUFsQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFtQ0E7QUFBQSxVQUdBLHVCQUFDLFNBQUksV0FBVSxlQUNiO0FBQUEsbUNBQUMsVUFBSyxXQUFVLHVFQUFzRSxzQ0FBdEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBNEc7QUFBQSxZQUM1Ryx1QkFBQyxTQUFJLFdBQVUsMElBQ1p4SSx3QkFBY2lCLFVBQVUsdUJBQUMsVUFBSyxXQUFVLHlCQUF3QixrQ0FBeEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBMEQsS0FEckY7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFFQTtBQUFBLGVBSkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFLQTtBQUFBLFVBR0EsdUJBQUMsU0FBSSxXQUFVLGFBQ2I7QUFBQSxtQ0FBQyxVQUFLLFdBQVUsdUVBQXNFLDZCQUF0RjtBQUFBO0FBQUE7QUFBQTtBQUFBLG1CQUFtRztBQUFBLFlBQ25HLHVCQUFDLFNBQUksV0FBVSwwQkFDWm5FLG1CQUFTaUMsT0FBTyxDQUFBa0ksTUFBS3RJLE9BQU9zSSxFQUFFN0ssU0FBUyxFQUFFaU4sWUFBWSxNQUFNMUssT0FBT3FCLGNBQWM1RCxTQUFTLEVBQUVpTixZQUFZLENBQUMsRUFBRTlOO0FBQUFBLGNBQUksQ0FBQTBMLE1BQzdHLHVCQUFDLFNBQXNCLFdBQVUsd0ZBQy9CO0FBQUEsdUNBQUMsU0FBSSxXQUFVLGlEQUFpREEsWUFBRTdLLGFBQWxFO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQTRFO0FBQUEsZ0JBQzVFLHVCQUFDLFNBQUksV0FBVSxnREFBZ0Q2SztBQUFBQSxvQkFBRXBMO0FBQUFBLGtCQUFVO0FBQUEsa0JBQUMsdUJBQUMsVUFBSyxXQUFVLGlEQUFnRCxxQkFBaEU7QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBcUU7QUFBQSxxQkFBako7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBd0o7QUFBQSxtQkFGaEpvTCxFQUFFN0ssV0FBWjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUdBO0FBQUEsWUFDRCxLQU5IO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBT0E7QUFBQSxlQVRGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBVUE7QUFBQSxVQUdDNEQsY0FBY2tMLGtCQUNiLHVCQUFDLFNBQUksV0FBVSxlQUNiO0FBQUEsbUNBQUMsVUFBSyxXQUFVLHVFQUFzRSxtQ0FBdEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBeUc7QUFBQSxZQUN6RztBQUFBLGNBQUM7QUFBQTtBQUFBLGdCQUNDLE1BQU1sTCxjQUFja0wsZUFBZUMsV0FBVyxNQUFNLElBQUluTCxjQUFja0wsaUJBQWlCLHdCQUF3QmxMLGNBQWNrTCxjQUFjO0FBQUEsZ0JBQzNJLFFBQU87QUFBQSxnQkFDUCxLQUFJO0FBQUEsZ0JBQ0osV0FBVTtBQUFBLGdCQUVWO0FBQUEseUNBQUMsWUFBUyxNQUFNLE1BQWhCO0FBQUE7QUFBQTtBQUFBO0FBQUEseUJBQW1CO0FBQUEsa0JBQ25CLHVCQUFDLFVBQUssd0NBQU47QUFBQTtBQUFBO0FBQUE7QUFBQSx5QkFBOEI7QUFBQTtBQUFBO0FBQUEsY0FQaEM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFlBUUE7QUFBQSxlQVZGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBV0E7QUFBQSxXQUlBbEwsY0FBY3lJLGNBQWN6SSxjQUFjMEksY0FBYzFJLGNBQWMySSxnQkFDdEUsdUJBQUMsU0FBSSxXQUFVLHVFQUNiO0FBQUEsbUNBQUMsVUFBSyxXQUFVLHVFQUFzRSw0QkFBdEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFBa0c7QUFBQSxZQUNsRyx1QkFBQyxTQUFJLFdBQVUscUVBQ2I7QUFBQSxxQ0FBQyxTQUNDO0FBQUEsdUNBQUMsVUFBSyxXQUFVLDRCQUEyQix3QkFBM0M7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBbUQ7QUFBQSxnQkFDbkQsdUJBQUMsVUFBSyxXQUFXN087QUFBQUEsa0JBQ2Y7QUFBQSxrQkFDQWtHLGNBQWNtRixXQUFXLGNBQWM7QUFBQSxtQkFDdENuRixjQUFjbUYsV0FBVyxjQUFjbkYsY0FBY21GLFdBQVcsZ0JBQWdCO0FBQUEsZ0JBQ25GLEdBQUluRix3QkFBY21GLFVBSmxCO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBSXlCO0FBQUEsbUJBTjNCO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBT0E7QUFBQSxjQUNDbkYsY0FBY29MLFlBQ2IsdUJBQUMsU0FDQztBQUFBLHVDQUFDLFVBQUssV0FBVSw0QkFBMkIsOEJBQTNDO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQXlEO0FBQUEsZ0JBQ3pELHVCQUFDLFVBQUssV0FBVSxlQUFlcEw7QUFBQUEsZ0NBQWNvTCxTQUFTQztBQUFBQSxrQkFBVTtBQUFBLGtCQUFFckwsY0FBY29MLFNBQVNFO0FBQUFBLHFCQUF6RjtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUFrRztBQUFBLG1CQUZwRztBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUdBO0FBQUEsY0FFRix1QkFBQyxTQUNDO0FBQUEsdUNBQUMsVUFBSyxXQUFVLDRCQUEyQiw4QkFBM0M7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBeUQ7QUFBQSxnQkFDekQsdUJBQUMsVUFBSyxXQUFVLGVBQ2J6UixnQkFBTW1HLGNBQWN5SSxjQUFjekksY0FBYzBJLGNBQWMxSSxjQUFjMkksV0FBVyxFQUFFeEMsT0FBTyxrQkFBa0IsS0FEckg7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFFQTtBQUFBLG1CQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBS0E7QUFBQSxjQUNDbkcsY0FBY3VMLG1CQUNiLHVCQUFDLFNBQUksV0FBVSxtRkFDYjtBQUFBLHVDQUFDLFVBQUssV0FBVSwyQkFBMEIsaUNBQTFDO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQTJEO0FBQUEsZ0JBQU87QUFBQSxnQkFBRXZMLGNBQWN1TDtBQUFBQSxtQkFEcEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFFQTtBQUFBLGNBRUR2TCxjQUFjcUssZUFDYix1QkFBQyxTQUFJLFdBQVUsbUZBQ2I7QUFBQSx1Q0FBQyxVQUFLLFdBQVUsNEJBQTJCLDhCQUEzQztBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUF5RDtBQUFBLGdCQUFPO0FBQUEsZ0JBQUVySyxjQUFjcUs7QUFBQUEsbUJBRGxGO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBRUE7QUFBQSxpQkE3Qko7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkErQkE7QUFBQSxlQWpDRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQWtDQTtBQUFBLFVBSURySyxjQUFjMEssTUFBTWMsc0JBQ25CLHVCQUFDLFNBQUksV0FBVSx3REFDYjtBQUFBLG1DQUFDLFVBQUssV0FBVSx3RUFBdUUsNENBQXZGO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQW1IO0FBQUEsWUFDbkgsdUJBQUMsU0FBSSxXQUFVLHVFQUNiO0FBQUEscUNBQUMsU0FDQztBQUFBLHVDQUFDLFVBQUssV0FBVSw2QkFBNEIsc0NBQTVDO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBQWtFO0FBQUEsZ0JBQ2xFLHVCQUFDLFVBQUssV0FBVSw0QkFDYjNSLGdCQUFNbUcsY0FBYzBLLEtBQUtjLG1CQUFtQkMsZ0JBQWdCLEVBQUV0RixPQUFPLFlBQVksS0FEcEY7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFFQTtBQUFBLG1CQUpGO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBS0E7QUFBQSxjQUNBLHVCQUFDLFNBQ0M7QUFBQSx1Q0FBQyxVQUFLLFdBQVUsNkJBQTRCLGdDQUE1QztBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUE0RDtBQUFBLGdCQUM1RCx1QkFBQyxVQUFLLFdBQVUsdUNBQ2JuRyx3QkFBYzBLLEtBQUtjLG1CQUFtQnJHLFVBRHpDO0FBQUE7QUFBQTtBQUFBO0FBQUEsdUJBRUE7QUFBQSxtQkFKRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUtBO0FBQUEsY0FDQSx1QkFBQyxTQUNDO0FBQUEsdUNBQUMsVUFBSyxXQUFVLDZCQUE0Qix3QkFBNUM7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBb0Q7QUFBQSxnQkFDcEQsdUJBQUMsVUFBSyxXQUFVLDhCQUE4Qm5GLHdCQUFjMEssS0FBS2MsbUJBQW1CdkssVUFBcEY7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBMkY7QUFBQSxtQkFGN0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFHQTtBQUFBLGNBQ0NqQixjQUFjMEssS0FBS2MsbUJBQW1CRSxZQUNyQyx1QkFBQyxTQUNDO0FBQUEsdUNBQUMsVUFBSyxXQUFVLDZCQUE0QiwwQkFBNUM7QUFBQTtBQUFBO0FBQUE7QUFBQSx1QkFBc0Q7QUFBQSxnQkFDdEQsdUJBQUMsVUFBSyxXQUFVLDhCQUE4QjFMLHdCQUFjMEssS0FBS2MsbUJBQW1CRSxZQUFwRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQUE2RjtBQUFBLG1CQUYvRjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUdBO0FBQUEsaUJBckJKO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBdUJBO0FBQUEsZUF6QkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkEwQkE7QUFBQSxhQTNKSjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBNkpBO0FBQUEsV0FsTEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQW1MQSxLQXBMRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBcUxBO0FBQUEsTUFDQW5HLFNBQVNFO0FBQUFBLElBQ1g7QUFBQSxPQXY2QkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQXk2QkE7QUFFSjtBQUFDaEksR0FudUN1QmpCLGtCQUFnQjtBQUFBLFVBa0JnQnpDLFNBbUJyQy9CLGFBQ0FDLFdBQVc7QUFBQTtBQUFBLE1BdENOdUU7QUFBZ0IsSUFBQXBDLElBQUFLLEtBQUFPLEtBQUF1QixLQUFBb1A7QUFBQSxhQUFBdlIsSUFBQTtBQUFBLGFBQUFLLEtBQUE7QUFBQSxhQUFBTyxLQUFBO0FBQUEsYUFBQXVCLEtBQUE7QUFBQSxhQUFBb1AsS0FBQSIsIm5hbWVzIjpbIlJlYWN0IiwidXNlU3RhdGUiLCJ1c2VFZmZlY3QiLCJ1c2VNZW1vIiwidXNlTG9jYXRpb24iLCJ1c2VOYXZpZ2F0ZSIsImNyZWF0ZVBvcnRhbCIsIkNhbGVuZGFyIiwiQ2FsZW5kYXJJY29uIiwiQ2xvY2siLCJGaWxlVGV4dCIsIlBsdXMiLCJDaGVja0NpcmNsZSIsIkFsZXJ0Q2lyY2xlIiwiWENpcmNsZSIsIlRyZW5kaW5nVXAiLCJNYXBQaW4iLCJDaGV2cm9uTGVmdCIsIkNoZXZyb25SaWdodCIsIkluZm8iLCJTZW5kIiwiSGlzdG9yeSIsIkNsaXBib2FyZExpc3QiLCJQbGFuZSIsIlNoaWVsZENoZWNrIiwiRG9sbGFyU2lnbiIsImFwaSIsIkF0dGVuZGFuY2VDYWxlbmRhciIsIkNsaWVudE1lZXRpbmdUcmFja2VyIiwiQXBwbHlMZWF2ZUZvcm0iLCJmb3JtYXREYXRlRERNTVlZWVkiLCJQYWdpbmF0aW9uIiwiRW1wdHkiLCJkYXlqcyIsImNsc3giLCJ1c2VSQkFDIiwiaXNFbXBsb3llZVBlbmRpbmdBY3RpdmF0aW9uIiwiU2VjdGlvbkhlYWRpbmciLCJ0aXRsZSIsInN1YnRpdGxlIiwiX2MiLCJUYWJCdXR0b24iLCJhY3RpdmUiLCJsYWJlbCIsIm9uQ2xpY2siLCJfYzIiLCJTdW1tYXJ5Q2FyZCIsInZhbHVlIiwiaWNvbiIsIkljb24iLCJiZ1RpbnQiLCJ0ZXh0Q29sb3IiLCJfYzMiLCJQb2xpY3lJbnNpZ2h0Q2FyZCIsInBvbGljeSIsImlzRWZmZWN0aXZlIiwibmFtZSIsImFwcGxpY2FibGVUbyIsInJ1bGVzIiwibWFwIiwicnVsZSIsImluZGV4IiwidG90YWwiLCJOdW1iZXIiLCJ0b3RhbFBlclllYXIiLCJhdmFpbGFibGUiLCJiYWxhbmNlIiwicHJvZ3Jlc3NWYWx1ZSIsIk1hdGgiLCJtaW4iLCJiYWNrZ3JvdW5kQ29sb3IiLCJjb2xvciIsImxlYXZlVHlwZSIsIndpZHRoIiwiX2lkIiwiX2M0IiwiQXR0ZW5kYW5jZU1vZHVsZSIsInByb2ZpbGUiLCJzdGF0cyIsImlzQ2hlY2tlZEluIiwiaXNDaGVja2VkT3V0IiwidG9kYXlSZWNvcmQiLCJiYWxhbmNlcyIsImxlYXZlcyIsImhhc0xlYXZlUG9saWN5IiwibGVhdmVQb2xpY2llcyIsImVmZmVjdGl2ZVBvbGljeUlkIiwiZmV0Y2hEYXNoYm9hcmREYXRhIiwiaGFuZGxlQ2FuY2VsTGVhdmUiLCJlZGl0TGVhdmUiLCJzZXRFZGl0TGVhdmUiLCJsYXN0TW9udGhBY2NydWFsIiwibGVhdmVQb2xpY3kiLCJfcyIsImhhc1Blcm1pc3Npb24iLCJsb2FkaW5nIiwicGVybWlzc2lvbkxvYWRpbmciLCJjYW5PcGVuQXR0ZW5kYW5jZSIsImNhblZpZXdBdHRlbmRhbmNlIiwiY2FuQ3JlYXRlQXR0ZW5kYW5jZSIsImNhbkVkaXRBdHRlbmRhbmNlIiwiY2FuRGVsZXRlQXR0ZW5kYW5jZSIsImNhbkFwcGx5TGVhdmUiLCJjYW5TZWVMZWF2ZUhpc3RvcnkiLCJjYW5TZWVSZXF1ZXN0SGlzdG9yeSIsIm9uYm9hcmRpbmdQZW5kaW5nIiwiZWZmZWN0aXZlTGVhdmVQb2xpY3kiLCJwb2xpY2llcyIsIkFycmF5IiwiaXNBcnJheSIsImZpbmQiLCJTdHJpbmciLCJsb2NhdGlvbiIsIm5hdmlnYXRlIiwiYXZhaWxhYmxlVGFicyIsImZpbHRlciIsIkJvb2xlYW4iLCJhY3RpdmVUYWIiLCJzZXRBY3RpdmVUYWIiLCJwYXJhbXMiLCJVUkxTZWFyY2hQYXJhbXMiLCJzZWFyY2giLCJ0YWJQYXJhbSIsImdldCIsImluY2x1ZGVzIiwibGVuZ3RoIiwiZWFybHlSZXR1cm5Nb2RhbCIsInNldEVhcmx5UmV0dXJuTW9kYWwiLCJpc09wZW4iLCJsZWF2ZUlkIiwibGVhdmVEYXRhIiwibmV3RW5kRGF0ZSIsInNlbGVjdGVkTGVhdmUiLCJzZXRTZWxlY3RlZExlYXZlIiwiaXNFYXJseVJldHVybmluZyIsInNldElzRWFybHlSZXR1cm5pbmciLCJsZWF2ZXNTdWJUYWIiLCJzZXRMZWF2ZXNTdWJUYWIiLCJlbmNhc2hDb25maWciLCJzZXRFbmNhc2hDb25maWciLCJiYXNpY1NhbGFyeSIsInNldEJhc2ljU2FsYXJ5IiwiZW5jYXNoUmVxdWVzdHMiLCJzZXRFbmNhc2hSZXF1ZXN0cyIsImVuY2FzaExvYWRpbmciLCJzZXRFbmNhc2hMb2FkaW5nIiwiZW5jYXNoRm9ybSIsInNldEVuY2FzaEZvcm0iLCJkYXlzIiwicmVhc29uIiwiZW5jYXNoU3VibWl0dGluZyIsInNldEVuY2FzaFN1Ym1pdHRpbmciLCJlbmNhc2hDYW5jZWxsaW5nIiwic2V0RW5jYXNoQ2FuY2VsbGluZyIsImZldGNoQ29uZmlnIiwiY2ZnUmVzIiwiZGF0YSIsImNvbmZpZyIsImUiLCJjb25zb2xlIiwiZXJyb3IiLCJmZXRjaFJlcXVlc3RzIiwicmVxUmVzIiwicmVxdWVzdHMiLCJoYW5kbGVFbmNhc2hTdWJtaXQiLCJwcmV2ZW50RGVmYXVsdCIsInBvc3QiLCJyZXF1ZXN0ZWREYXlzIiwicGFyc2VJbnQiLCJhbGVydCIsImVyciIsInJlc3BvbnNlIiwiaGFuZGxlRW5jYXNoQ2FuY2VsIiwicmVxdWVzdElkIiwiaGFuZGxlRWFybHlSZXR1cm5TdWJtaXQiLCJjdXJyZW50TW9udGgiLCJzZXRDdXJyZW50TW9udGgiLCJEYXRlIiwiZ2V0TW9udGgiLCJjdXJyZW50WWVhciIsInNldEN1cnJlbnRZZWFyIiwiZ2V0RnVsbFllYXIiLCJtb250aGx5QXR0ZW5kYW5jZSIsInNldE1vbnRobHlBdHRlbmRhbmNlIiwiaG9saWRheXMiLCJzZXRIb2xpZGF5cyIsInNldHRpbmdzIiwic2V0U2V0dGluZ3MiLCJfbG9hZGluZ0F0dGVuZGFuY2UiLCJzZXRMb2FkaW5nQXR0ZW5kYW5jZSIsInNldFJlcXVlc3RzIiwicmVxdWVzdEZvcm0iLCJzZXRSZXF1ZXN0Rm9ybSIsInN0YXJ0RGF0ZSIsImVuZERhdGUiLCJjaGVja0luIiwiY2hlY2tPdXQiLCJzdWJtaXR0aW5nUmVxdWVzdCIsInNldFN1Ym1pdHRpbmdSZXF1ZXN0IiwiZmV0Y2hNb250aGx5RGF0YSIsImZldGNoUmVxdWVzdEhpc3RvcnkiLCJhdHRSZXMiLCJob2xpZGF5UmVzIiwic2V0dGluZ3NSZXMiLCJQcm9taXNlIiwiYWxsIiwicmVzIiwiaGFuZGxlUmVxdWVzdFN1Ym1pdCIsInBheWxvYWQiLCJjYXRlZ29yeSIsImlzc3VlVHlwZSIsInJlcXVlc3RlZERhdGEiLCJwdW5jaEluIiwicHVuY2hPdXQiLCJnZXRTdGF0dXNCYWRnZSIsInN0YXR1cyIsInMiLCJ0b0xvd2VyQ2FzZSIsImJhc2UiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwiYm9keSIsInByZXNlbnREYXlzIiwiYWJzZW50RGF5Q291bnQiLCJsZWF2ZXNUYWtlbiIsImVmZmVjdGl2ZVNoaWZ0Iiwic3RhcnRUaW1lIiwiZW5kVGltZSIsImlzTmlnaHRTaGlmdCIsInkiLCJtIiwiZm9ybWF0IiwiZWxSdWxlIiwiciIsImFjY3J1YWxEZXBlbmRzT25BdHRlbmRhbmNlIiwicGFydHMiLCJjb3VudFByZXNlbnQiLCJwdXNoIiwiY291bnRPbkR1dHkiLCJjb3VudENvbXBPZmYiLCJjb3VudEhvbGlkYXkiLCJjb3VudFdlZWtseU9mZiIsImNvdW50UGFpZExlYXZlIiwiam9pbiIsIm1pbkF0dGVuZGFuY2VEYXlzIiwiYiIsImVsaWdpYmxlRGF5cyIsImZvcm11bGFBcHBsaWVkIiwiaSIsInR5cGVMZWF2ZXMiLCJsIiwidXNlZCIsInJlZHVjZSIsImFjYyIsImN1cnIiLCJkYXlzQ291bnQiLCJwZW5kaW5nIiwicmVtYWluaW5nIiwiY29sb3JzIiwidGV4dCIsImJnIiwiYm9yZGVyIiwiYWNjZW50IiwiYWxsb3dlZCIsInNvcnQiLCJhIiwibGVhdmUiLCJpc0hhbGZEYXkiLCJoYWxmRGF5U2Vzc2lvbiIsImFwcHJvdmVkQXQiLCJyZWplY3RlZEF0IiwiY2FuY2VsbGVkQXQiLCJzdG9wUHJvcGFnYXRpb24iLCJpc0JlZm9yZSIsImVuZE9mIiwiUFJFU0VOVEVEX0lNQUdFX1NJTVBMRSIsIm1heEVuY2FzaGFibGVEYXlzIiwibWluQmFsYW5jZVJldGFpbiIsImZvcm11bGEiLCJ0YXhSdWxlIiwiZW5jYXNoYWJsZUJhbGFuY2UiLCJ0b1VwcGVyQ2FzZSIsImF2YWlsYWJsZURheXMiLCJkYXlzTnVtIiwidmFsaWRhdGlvbkVycm9yIiwicGF5b3V0QW1vdW50Iiwicm91bmQiLCJwcmV2IiwidGFyZ2V0IiwidG9Mb2NhbGVTdHJpbmciLCJyZXEiLCJzdGF0dXNDb2xvciIsIlBlbmRpbmciLCJBcHByb3ZlZCIsIlJlamVjdGVkIiwiQ2FuY2VsbGVkIiwiYXZhaWxhYmxlQmFsYW5jZSIsImFkbWluUmVtYXJrIiwiY3JlYXRlZEF0IiwiZnVsbENhbmNlbERhdGUiLCJzdWJ0cmFjdCIsInNsaWNlIiwibWV0YSIsImN1c3RvbSIsImN1c3RvbUhhbGZEYXlzIiwiZmlyc3REYXlIYWxmIiwibGFzdERheUhhbGYiLCJmaXJzdERheVNlc3Npb24iLCJzcGxpdCIsImxhc3REYXlTZXNzaW9uIiwibWVkaWNhbENlcnRVcmwiLCJzdGFydHNXaXRoIiwiYWN0aW9uQnkiLCJmaXJzdE5hbWUiLCJsYXN0TmFtZSIsInJlamVjdGlvblJlYXNvbiIsImVhcmx5UmV0dXJuUmVxdWVzdCIsImFjdHVhbFJldHVybkRhdGUiLCJjb21tZW50cyIsIl9jNSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJBdHRlbmRhbmNlTW9kdWxlLmpzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlU3RhdGUsIHVzZUVmZmVjdCwgdXNlTWVtbyB9IGZyb20gJ3JlYWN0JztcclxuaW1wb3J0IHsgdXNlTG9jYXRpb24sIHVzZU5hdmlnYXRlIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XHJcbmltcG9ydCB7IGNyZWF0ZVBvcnRhbCB9IGZyb20gJ3JlYWN0LWRvbSc7XHJcbmltcG9ydCB7XHJcbiAgQ2FsZW5kYXIgYXMgQ2FsZW5kYXJJY29uLFxyXG4gIENsb2NrLFxyXG4gIEZpbGVUZXh0LFxyXG4gIFBsdXMsXHJcbiAgQ2hlY2tDaXJjbGUsXHJcbiAgQWxlcnRDaXJjbGUsXHJcbiAgWENpcmNsZSxcclxuICBUcmVuZGluZ1VwLFxyXG4gIE1hcFBpbixcclxuICBDaGV2cm9uTGVmdCxcclxuICBDaGV2cm9uUmlnaHQsXHJcbiAgSW5mbyxcclxuICBTZW5kLFxyXG4gIEhpc3RvcnksXHJcbiAgQ2xpcGJvYXJkTGlzdCxcclxuICBQbGFuZSxcclxuICBTaGllbGRDaGVjayxcclxuICBEb2xsYXJTaWduXHJcbn0gZnJvbSAnbHVjaWRlLXJlYWN0JztcclxuaW1wb3J0IGFwaSBmcm9tICcuLi8uLi91dGlscy9hcGknO1xyXG5pbXBvcnQgQXR0ZW5kYW5jZUNhbGVuZGFyIGZyb20gJy4uLy4uL2NvbXBvbmVudHMvQXR0ZW5kYW5jZUNhbGVuZGFyJztcclxuaW1wb3J0IENsaWVudE1lZXRpbmdUcmFja2VyIGZyb20gJy4uLy4uL2NvbXBvbmVudHMvYXR0ZW5kYW5jZS9DbGllbnRNZWV0aW5nVHJhY2tlcic7XHJcbmltcG9ydCBBcHBseUxlYXZlRm9ybSBmcm9tICcuLi8uLi9jb21wb25lbnRzL0FwcGx5TGVhdmVGb3JtJztcclxuaW1wb3J0IHsgZm9ybWF0RGF0ZURETU1ZWVlZIH0gZnJvbSAnLi4vLi4vdXRpbHMvZGF0ZVV0aWxzJztcclxuaW1wb3J0IHsgUGFnaW5hdGlvbiwgRW1wdHkgfSBmcm9tICdhbnRkJztcclxuaW1wb3J0IGRheWpzIGZyb20gJ2RheWpzJztcclxuaW1wb3J0IGNsc3ggZnJvbSAnY2xzeCc7XHJcbmltcG9ydCB7IHVzZVJCQUMgfSBmcm9tICcuLi8uLi9jb250ZXh0L1JCQUNDb250ZXh0JztcclxuaW1wb3J0IHsgaXNFbXBsb3llZVBlbmRpbmdBY3RpdmF0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW1wbG95ZWVQcm9maWxlJztcclxuXHJcbmNvbnN0IFNlY3Rpb25IZWFkaW5nID0gKHsgdGl0bGUsIHN1YnRpdGxlIH0pID0+IChcclxuICA8ZGl2IGNsYXNzTmFtZT1cIm1iLTEuNVwiPlxyXG4gICAgPGgzIGNsYXNzTmFtZT1cInRleHQtWzE0cHhdIGZvbnQtc2VtaWJvbGQgdGV4dC1bIzMzNDE1NV0gbGVhZGluZy10aWdodCBtYi0wLjVcIj57dGl0bGV9PC9oMz5cclxuICAgIHtzdWJ0aXRsZSAmJiA8cCBjbGFzc05hbWU9XCJ0ZXh0LVsjNjQ3NDhCXSB0ZXh0LVsxMHB4XSBmb250LW1lZGl1bSBvcGFjaXR5LTgwXCI+e3N1YnRpdGxlfTwvcD59XHJcbiAgPC9kaXY+XHJcbik7XHJcblxyXG5jb25zdCBUYWJCdXR0b24gPSAoeyBhY3RpdmUsIGxhYmVsLCBvbkNsaWNrIH0pID0+IChcclxuICA8YnV0dG9uXHJcbiAgICBvbkNsaWNrPXtvbkNsaWNrfVxyXG4gICAgY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICBcInJlbGF0aXZlIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHB4LTQgcHktMC41IGJvcmRlci1iLTIgdGV4dC1bMTNweF0gZm9udC1zZW1pYm9sZCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDAgYWN0aXZlOnNjYWxlLVswLjk4XVwiLFxyXG4gICAgICBhY3RpdmVcclxuICAgICAgICA/IFwiYm9yZGVyLVsjMjU2M0VCXSB0ZXh0LVsjMUU0MEFGXVwiXHJcbiAgICAgICAgOiBcImJvcmRlci10cmFuc3BhcmVudCB0ZXh0LVsjNjQ3NDhCXSBob3Zlcjp0ZXh0LVsjMzM0MTU1XVwiXHJcbiAgICApfVxyXG4gID5cclxuICAgIDxzcGFuPntsYWJlbH08L3NwYW4+XHJcbiAgPC9idXR0b24+XHJcbik7XHJcblxyXG5jb25zdCBTdW1tYXJ5Q2FyZCA9ICh7IGxhYmVsLCB2YWx1ZSwgaWNvbjogSWNvbiwgYmdUaW50LCB0ZXh0Q29sb3IgfSkgPT4gKFxyXG4gIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIGJnLXdoaXRlIHAtMiByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItWyNFMkU4RjBdIHNoYWRvdy1zbSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gdHJhbnNpdGlvbi1hbGwgaG92ZXI6c2hhZG93LW1kIGdyb3VwXCI+XHJcbiAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2xcIj5cclxuICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bIzY0NzQ4Ql0gdGV4dC1bOXB4XSBmb250LXNlbWlib2xkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBtYi0wLjVcIj57bGFiZWx9PC9zcGFuPlxyXG4gICAgICA8c3BhbiBjbGFzc05hbWU9e2Nsc3goXCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgbGVhZGluZy10aWdodCB0ZXh0LXNsYXRlLTkwMFwiLCB0ZXh0Q29sb3IpfT57dmFsdWV9PC9zcGFuPlxyXG4gICAgPC9kaXY+XHJcbiAgICA8ZGl2IGNsYXNzTmFtZT17Y2xzeChcInctOCBoLTggcm91bmRlZC1sZyBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB0cmFuc2l0aW9uLWFsbCBncm91cC1ob3ZlcjpzY2FsZS0xMTBcIiwgYmdUaW50LCB0ZXh0Q29sb3IpfT5cclxuICAgICAgPEljb24gc2l6ZT17MTZ9IC8+XHJcbiAgICA8L2Rpdj5cclxuICA8L2Rpdj5cclxuKTtcclxuXHJcbmNvbnN0IFBvbGljeUluc2lnaHRDYXJkID0gKHsgcG9saWN5IH0pID0+IChcclxuICA8ZGl2XHJcbiAgICBjbGFzc05hbWU9e2Nsc3goXHJcbiAgICAgICdyb3VuZGVkLXhsIGJvcmRlciBwLTEuNSBzaGFkb3ctc20gdHJhbnNpdGlvbi1hbGwgaG92ZXI6c2hhZG93LW1kIHctWzM4MHB4XSBoLVsxMTBweF0gb3ZlcmZsb3ctaGlkZGVuJyxcclxuICAgICAgcG9saWN5Py5pc0VmZmVjdGl2ZSA/ICdib3JkZXItWyNCRkRCRkVdIGJnLVsjRjhGQkZGXScgOiAnYm9yZGVyLVsjRTJFOEYwXSBiZy13aGl0ZSdcclxuICAgICl9XHJcbiAgPlxyXG4gICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gbWItMVwiPlxyXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjVcIj5cclxuICAgICAgICA8aDQgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1zZW1pYm9sZCB0ZXh0LVsjMzM0MTU1XSB0cnVuY2F0ZSBtYXgtdy1bMTAwcHhdXCI+e3BvbGljeT8ubmFtZSB8fCAnTGVhdmUgUG9saWN5J308L2g0PlxyXG4gICAgICAgIHtwb2xpY3k/LmlzRWZmZWN0aXZlICYmIChcclxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImJnLVsjREJFQUZFXSBweC0xLjUgcHktMC41IHRleHQtWzhweF0gZm9udC1zZW1pYm9sZCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXIgdGV4dC1bIzFENEVEOF0gcm91bmRlZFwiPkFjdGl2ZTwvc3Bhbj5cclxuICAgICAgICApfVxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bOHB4XSBmb250LW1lZGl1bSB1cHBlcmNhc2UgdGV4dC1bIzY0NzQ4Ql1cIj5TY29wZToge3BvbGljeT8uYXBwbGljYWJsZVRvIHx8ICdBbGwnfTwvc3Bhbj5cclxuICAgIDwvZGl2PlxyXG5cclxuXHJcbiAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTEgZ3JpZCBncmlkLWNvbHMtMyBnYXAtMVwiPlxyXG4gICAgICB7KHBvbGljeT8ucnVsZXMgfHwgW10pLm1hcCgocnVsZSwgaW5kZXgpID0+IHtcclxuICAgICAgICBjb25zdCB0b3RhbCA9IE51bWJlcihydWxlPy50b3RhbFBlclllYXIgfHwgMCk7XHJcbiAgICAgICAgY29uc3QgYXZhaWxhYmxlID0gcnVsZT8uYmFsYW5jZT8uYXZhaWxhYmxlO1xyXG4gICAgICAgIGNvbnN0IHByb2dyZXNzVmFsdWUgPSBydWxlPy5iYWxhbmNlID8gTWF0aC5taW4oMTAwLCAoKGF2YWlsYWJsZSB8fCAwKSAvICh0b3RhbCB8fCAxKSkgKiAxMDApIDogMTAwO1xyXG5cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgPGRpdiBrZXk9e2Ake3BvbGljeT8uX2lkIHx8IHBvbGljeT8ubmFtZX0tJHtydWxlPy5sZWF2ZVR5cGUgfHwgaW5kZXh9YH0gY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgYmctd2hpdGUvODAgcC0wLjUgcm91bmRlZCBib3JkZXIgYm9yZGVyLXNsYXRlLTEwMFwiPlxyXG4gICAgICAgICAgICA8c3BhblxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImgtMS41IHctMS41IHNocmluay0wIHJvdW5kZWQtZnVsbFwiXHJcbiAgICAgICAgICAgICAgc3R5bGU9e3sgYmFja2dyb3VuZENvbG9yOiBydWxlPy5jb2xvciB8fCAnIzI1NjNFQicgfX1cclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidHJ1bmNhdGUgdGV4dC1bOXB4XSBmb250LXNlbWlib2xkIHRleHQtWyMzMzQxNTVdIHctOFwiPntydWxlPy5sZWF2ZVR5cGUgfHwgJ0xlYXZlJ308L3NwYW4+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIGgtMSBvdmVyZmxvdy1oaWRkZW4gcm91bmRlZC1mdWxsIGJnLXNsYXRlLTEwMCBteC0xXCI+XHJcbiAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiaC1mdWxsIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi03MDBcIlxyXG4gICAgICAgICAgICAgICAgc3R5bGU9e3sgd2lkdGg6IGAke3Byb2dyZXNzVmFsdWV9JWAsIGJhY2tncm91bmRDb2xvcjogcnVsZT8uY29sb3IgfHwgJyMyNTYzRUInIH19XHJcbiAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzhweF0gZm9udC1ib2xkIHRleHQtWyMyNTYzRUJdIHdoaXRlc3BhY2Utbm93cmFwXCI+XHJcbiAgICAgICAgICAgICAge3J1bGU/LmJhbGFuY2UgPyBgJHthdmFpbGFibGUgfHwgMH0vJHt0b3RhbH1gIDogYCR7dG90YWx9eWB9XHJcbiAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICk7XHJcbiAgICAgIH0pfVxyXG4gICAgPC9kaXY+XHJcbiAgPC9kaXY+XHJcbik7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBBdHRlbmRhbmNlTW9kdWxlKHtcclxuICBwcm9maWxlLFxyXG4gIHN0YXRzLFxyXG4gIGlzQ2hlY2tlZEluLFxyXG4gIGlzQ2hlY2tlZE91dCxcclxuICB0b2RheVJlY29yZCxcclxuICBiYWxhbmNlcyxcclxuICBsZWF2ZXMsXHJcbiAgaGFzTGVhdmVQb2xpY3ksXHJcbiAgbGVhdmVQb2xpY2llcyA9IFtdLFxyXG4gIGVmZmVjdGl2ZVBvbGljeUlkID0gbnVsbCxcclxuICBmZXRjaERhc2hib2FyZERhdGEsXHJcbiAgaGFuZGxlQ2FuY2VsTGVhdmUsXHJcbiAgZWRpdExlYXZlLFxyXG4gIHNldEVkaXRMZWF2ZSxcclxuICBsYXN0TW9udGhBY2NydWFsID0gbnVsbCxcclxuICBsZWF2ZVBvbGljeSA9IG51bGxcclxufSkge1xyXG4gIGNvbnN0IHsgaGFzUGVybWlzc2lvbiwgbG9hZGluZzogcGVybWlzc2lvbkxvYWRpbmcgfSA9IHVzZVJCQUMoKTtcclxuICBjb25zdCBjYW5PcGVuQXR0ZW5kYW5jZSA9IGhhc1Blcm1pc3Npb24oJ2VtcGxveWVlLmF0dGVuZGFuY2UnLCAnYW55Jyk7XHJcbiAgY29uc3QgY2FuVmlld0F0dGVuZGFuY2UgPSBoYXNQZXJtaXNzaW9uKCdlbXBsb3llZS5hdHRlbmRhbmNlJywgJ3ZpZXcnKTtcclxuICBjb25zdCBjYW5DcmVhdGVBdHRlbmRhbmNlID0gaGFzUGVybWlzc2lvbignZW1wbG95ZWUuYXR0ZW5kYW5jZScsICdjcmVhdGUnKTtcclxuICBjb25zdCBjYW5FZGl0QXR0ZW5kYW5jZSA9IGhhc1Blcm1pc3Npb24oJ2VtcGxveWVlLmF0dGVuZGFuY2UnLCAnZWRpdCcpO1xyXG4gIGNvbnN0IGNhbkRlbGV0ZUF0dGVuZGFuY2UgPSBoYXNQZXJtaXNzaW9uKCdlbXBsb3llZS5hdHRlbmRhbmNlJywgJ2RlbGV0ZScpO1xyXG4gIGNvbnN0IGNhbkFwcGx5TGVhdmUgPSBjYW5DcmVhdGVBdHRlbmRhbmNlIHx8IGNhblZpZXdBdHRlbmRhbmNlO1xyXG4gIGNvbnN0IGNhblNlZUxlYXZlSGlzdG9yeSA9IGNhblZpZXdBdHRlbmRhbmNlIHx8IGNhbkVkaXRBdHRlbmRhbmNlIHx8IGNhbkRlbGV0ZUF0dGVuZGFuY2U7XHJcbiAgY29uc3QgY2FuU2VlUmVxdWVzdEhpc3RvcnkgPSBjYW5WaWV3QXR0ZW5kYW5jZSB8fCBjYW5FZGl0QXR0ZW5kYW5jZSB8fCBjYW5EZWxldGVBdHRlbmRhbmNlO1xyXG4gIGNvbnN0IG9uYm9hcmRpbmdQZW5kaW5nID0gdXNlTWVtbygoKSA9PiBpc0VtcGxveWVlUGVuZGluZ0FjdGl2YXRpb24ocHJvZmlsZSksIFtwcm9maWxlXSk7XHJcbiAgY29uc3QgZWZmZWN0aXZlTGVhdmVQb2xpY3kgPSB1c2VNZW1vKCgpID0+IHtcclxuICAgIGNvbnN0IHBvbGljaWVzID0gQXJyYXkuaXNBcnJheShsZWF2ZVBvbGljaWVzKSA/IGxlYXZlUG9saWNpZXMgOiBbXTtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIHBvbGljaWVzLmZpbmQoKHBvbGljeSkgPT4gcG9saWN5Py5pc0VmZmVjdGl2ZSB8fCBTdHJpbmcocG9saWN5Py5faWQgfHwgJycpID09PSBTdHJpbmcoZWZmZWN0aXZlUG9saWN5SWQgfHwgJycpKSB8fFxyXG4gICAgICBwb2xpY2llc1swXSB8fFxyXG4gICAgICBwcm9maWxlPy5sZWF2ZVBvbGljeSB8fFxyXG4gICAgICBudWxsXHJcbiAgICApO1xyXG4gIH0sIFtlZmZlY3RpdmVQb2xpY3lJZCwgbGVhdmVQb2xpY2llcywgcHJvZmlsZT8ubGVhdmVQb2xpY3ldKTtcclxuICBjb25zdCBsb2NhdGlvbiA9IHVzZUxvY2F0aW9uKCk7XHJcbiAgY29uc3QgbmF2aWdhdGUgPSB1c2VOYXZpZ2F0ZSgpO1xyXG5cclxuICBjb25zdCBhdmFpbGFibGVUYWJzID0gdXNlTWVtbygoKSA9PiBbXHJcbiAgICBjYW5WaWV3QXR0ZW5kYW5jZSA/ICdhdHRlbmRhbmNlJyA6IG51bGwsXHJcbiAgICAoY2FuQXBwbHlMZWF2ZSB8fCBjYW5TZWVMZWF2ZUhpc3RvcnkpID8gJ2xlYXZlcycgOiBudWxsLFxyXG4gICAgKGNhbkNyZWF0ZUF0dGVuZGFuY2UgfHwgY2FuU2VlUmVxdWVzdEhpc3RvcnkpID8gJ3JlcXVlc3RzJyA6IG51bGwsXHJcbiAgXS5maWx0ZXIoQm9vbGVhbiksIFtjYW5WaWV3QXR0ZW5kYW5jZSwgY2FuQ3JlYXRlQXR0ZW5kYW5jZSwgY2FuQXBwbHlMZWF2ZSwgY2FuU2VlTGVhdmVIaXN0b3J5LCBjYW5TZWVSZXF1ZXN0SGlzdG9yeV0pO1xyXG4gIGNvbnN0IFthY3RpdmVUYWIsIHNldEFjdGl2ZVRhYl0gPSB1c2VTdGF0ZShhdmFpbGFibGVUYWJzWzBdIHx8ICdhdHRlbmRhbmNlJyk7XHJcblxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKGxvY2F0aW9uLnNlYXJjaCk7XHJcbiAgICBjb25zdCB0YWJQYXJhbSA9IHBhcmFtcy5nZXQoJ3RhYicpO1xyXG4gICAgaWYgKHRhYlBhcmFtICYmIGF2YWlsYWJsZVRhYnMuaW5jbHVkZXModGFiUGFyYW0pKSB7XHJcbiAgICAgIHNldEFjdGl2ZVRhYih0YWJQYXJhbSk7XHJcbiAgICB9IGVsc2UgaWYgKCF0YWJQYXJhbSAmJiBhdmFpbGFibGVUYWJzLmxlbmd0aCA+IDApIHtcclxuICAgICAgc2V0QWN0aXZlVGFiKGF2YWlsYWJsZVRhYnNbMF0pO1xyXG4gICAgfVxyXG4gIH0sIFtsb2NhdGlvbi5zZWFyY2gsIGF2YWlsYWJsZVRhYnNdKTtcclxuICBcclxuICBjb25zdCBbZWFybHlSZXR1cm5Nb2RhbCwgc2V0RWFybHlSZXR1cm5Nb2RhbF0gPSB1c2VTdGF0ZSh7IGlzT3BlbjogZmFsc2UsIGxlYXZlSWQ6IG51bGwsIGxlYXZlRGF0YTogbnVsbCwgbmV3RW5kRGF0ZTogJycgfSk7XHJcbiAgY29uc3QgW3NlbGVjdGVkTGVhdmUsIHNldFNlbGVjdGVkTGVhdmVdID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgW2lzRWFybHlSZXR1cm5pbmcsIHNldElzRWFybHlSZXR1cm5pbmddID0gdXNlU3RhdGUoZmFsc2UpO1xyXG5cclxuICAvLyBFbmNhc2htZW50IHN1Yi10YWIgc3RhdGVcclxuICBjb25zdCBbbGVhdmVzU3ViVGFiLCBzZXRMZWF2ZXNTdWJUYWJdID0gdXNlU3RhdGUoJ2FwcGx5Jyk7IC8vICdhcHBseScgfCAnZW5jYXNobWVudCdcclxuICBjb25zdCBbZW5jYXNoQ29uZmlnLCBzZXRFbmNhc2hDb25maWddID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgW2Jhc2ljU2FsYXJ5LCBzZXRCYXNpY1NhbGFyeV0gPSB1c2VTdGF0ZSgwKTtcclxuICBjb25zdCBbZW5jYXNoUmVxdWVzdHMsIHNldEVuY2FzaFJlcXVlc3RzXSA9IHVzZVN0YXRlKFtdKTtcclxuICBjb25zdCBbZW5jYXNoTG9hZGluZywgc2V0RW5jYXNoTG9hZGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2VuY2FzaEZvcm0sIHNldEVuY2FzaEZvcm1dID0gdXNlU3RhdGUoeyBkYXlzOiAnJywgcmVhc29uOiAnJyB9KTtcclxuICBjb25zdCBbZW5jYXNoU3VibWl0dGluZywgc2V0RW5jYXNoU3VibWl0dGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2VuY2FzaENhbmNlbGxpbmcsIHNldEVuY2FzaENhbmNlbGxpbmddID0gdXNlU3RhdGUobnVsbCk7XHJcblxyXG4gIC8vIEZldGNoIGVuY2FzaG1lbnQgY29uZmlnIHdoZW4gYWN0aXZlVGFiIGlzICdsZWF2ZXMnIChzbyB3ZSBjYW4gcmVuZGVyIHRoZSBzdWItdGFiIHRvZ2dsZSlcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKGFjdGl2ZVRhYiAhPT0gJ2xlYXZlcycpIHJldHVybjtcclxuICAgIGNvbnN0IGZldGNoQ29uZmlnID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IGNmZ1JlcyA9IGF3YWl0IGFwaS5nZXQoJy9lbXBsb3llZS9sZWF2ZXMvZW5jYXNobWVudC9jb25maWcnKTtcclxuICAgICAgICBzZXRFbmNhc2hDb25maWcoY2ZnUmVzLmRhdGE/LmNvbmZpZyB8fCBudWxsKTtcclxuICAgICAgICBpZiAoY2ZnUmVzLmRhdGE/LmJhc2ljU2FsYXJ5KSB7XHJcbiAgICAgICAgICBzZXRCYXNpY1NhbGFyeShjZmdSZXMuZGF0YS5iYXNpY1NhbGFyeSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignW2VuY2FzaG1lbnRdIGZldGNoIGNvbmZpZyBlcnJvcjonLCBlKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIGZldGNoQ29uZmlnKCk7XHJcbiAgfSwgW2FjdGl2ZVRhYl0pO1xyXG5cclxuICAvLyBGZXRjaCBlbmNhc2htZW50IHJlcXVlc3RzIHdoZW4gc3ViLXRhYiBpcyAnZW5jYXNobWVudCdcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKGFjdGl2ZVRhYiAhPT0gJ2xlYXZlcycgfHwgbGVhdmVzU3ViVGFiICE9PSAnZW5jYXNobWVudCcpIHJldHVybjtcclxuICAgIGNvbnN0IGZldGNoUmVxdWVzdHMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICAgIHNldEVuY2FzaExvYWRpbmcodHJ1ZSk7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcmVxUmVzID0gYXdhaXQgYXBpLmdldCgnL2VtcGxveWVlL2xlYXZlcy9lbmNhc2htZW50L3JlcXVlc3RzJyk7XHJcbiAgICAgICAgc2V0RW5jYXNoUmVxdWVzdHMocmVxUmVzLmRhdGE/LnJlcXVlc3RzIHx8IFtdKTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tlbmNhc2htZW50XSBmZXRjaCByZXF1ZXN0cyBlcnJvcjonLCBlKTtcclxuICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICBzZXRFbmNhc2hMb2FkaW5nKGZhbHNlKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIGZldGNoUmVxdWVzdHMoKTtcclxuICB9LCBbYWN0aXZlVGFiLCBsZWF2ZXNTdWJUYWJdKTtcclxuXHJcbiAgY29uc3QgaGFuZGxlRW5jYXNoU3VibWl0ID0gYXN5bmMgKGUpID0+IHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIHNldEVuY2FzaFN1Ym1pdHRpbmcodHJ1ZSk7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBhcGkucG9zdCgnL2VtcGxveWVlL2xlYXZlcy9lbmNhc2htZW50L3JlcXVlc3RzJywge1xyXG4gICAgICAgIHJlcXVlc3RlZERheXM6IHBhcnNlSW50KGVuY2FzaEZvcm0uZGF5cyksXHJcbiAgICAgICAgcmVhc29uOiBlbmNhc2hGb3JtLnJlYXNvblxyXG4gICAgICB9KTtcclxuICAgICAgc2V0RW5jYXNoRm9ybSh7IGRheXM6ICcnLCByZWFzb246ICcnIH0pO1xyXG4gICAgICAvLyBSZWZyZXNoIHJlcXVlc3RzXHJcbiAgICAgIGNvbnN0IHJlcVJlcyA9IGF3YWl0IGFwaS5nZXQoJy9lbXBsb3llZS9sZWF2ZXMvZW5jYXNobWVudC9yZXF1ZXN0cycpO1xyXG4gICAgICBzZXRFbmNhc2hSZXF1ZXN0cyhyZXFSZXMuZGF0YT8ucmVxdWVzdHMgfHwgW10pO1xyXG4gICAgICBhbGVydCgnRW5jYXNobWVudCByZXF1ZXN0IHN1Ym1pdHRlZCBzdWNjZXNzZnVsbHkhIEhSIHdpbGwgcmV2aWV3IGl0LicpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGFsZXJ0KGVycj8ucmVzcG9uc2U/LmRhdGE/LmVycm9yIHx8ICdGYWlsZWQgdG8gc3VibWl0IGVuY2FzaG1lbnQgcmVxdWVzdC4nKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldEVuY2FzaFN1Ym1pdHRpbmcoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGhhbmRsZUVuY2FzaENhbmNlbCA9IGFzeW5jIChyZXF1ZXN0SWQpID0+IHtcclxuICAgIHNldEVuY2FzaENhbmNlbGxpbmcocmVxdWVzdElkKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IGFwaS5wb3N0KGAvZW1wbG95ZWUvbGVhdmVzL2VuY2FzaG1lbnQvcmVxdWVzdHMvJHtyZXF1ZXN0SWR9L2NhbmNlbGApO1xyXG4gICAgICBjb25zdCByZXFSZXMgPSBhd2FpdCBhcGkuZ2V0KCcvZW1wbG95ZWUvbGVhdmVzL2VuY2FzaG1lbnQvcmVxdWVzdHMnKTtcclxuICAgICAgc2V0RW5jYXNoUmVxdWVzdHMocmVxUmVzLmRhdGE/LnJlcXVlc3RzIHx8IFtdKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBhbGVydChlcnI/LnJlc3BvbnNlPy5kYXRhPy5lcnJvciB8fCAnRmFpbGVkIHRvIGNhbmNlbCByZXF1ZXN0LicpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0RW5jYXNoQ2FuY2VsbGluZyhudWxsKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuXHJcbiAgY29uc3QgaGFuZGxlRWFybHlSZXR1cm5TdWJtaXQgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWVhcmx5UmV0dXJuTW9kYWwubmV3RW5kRGF0ZSkgcmV0dXJuO1xyXG4gICAgdHJ5IHtcclxuICAgICAgc2V0SXNFYXJseVJldHVybmluZyh0cnVlKTtcclxuICAgICAgYXdhaXQgYXBpLnBvc3QoYC9lbXBsb3llZS9sZWF2ZXMvZWFybHktcmV0dXJuLyR7ZWFybHlSZXR1cm5Nb2RhbC5sZWF2ZUlkfWAsIHsgbmV3RW5kRGF0ZTogZWFybHlSZXR1cm5Nb2RhbC5uZXdFbmREYXRlIH0pO1xyXG4gICAgICBzZXRFYXJseVJldHVybk1vZGFsKHsgaXNPcGVuOiBmYWxzZSwgbGVhdmVJZDogbnVsbCwgbGVhdmVEYXRhOiBudWxsLCBuZXdFbmREYXRlOiAnJyB9KTtcclxuICAgICAgZmV0Y2hEYXNoYm9hcmREYXRhKCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgYWxlcnQoZXJyb3IucmVzcG9uc2U/LmRhdGE/LmVycm9yIHx8IFwiRmFpbGVkIHRvIHByb2Nlc3MgZWFybHkgcmV0dXJuXCIpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0SXNFYXJseVJldHVybmluZyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcblxyXG4gIC8vIFRhYiBTdGF0ZVxyXG4gIGNvbnN0IFtjdXJyZW50TW9udGgsIHNldEN1cnJlbnRNb250aF0gPSB1c2VTdGF0ZShuZXcgRGF0ZSgpLmdldE1vbnRoKCkpO1xyXG4gIGNvbnN0IFtjdXJyZW50WWVhciwgc2V0Q3VycmVudFllYXJdID0gdXNlU3RhdGUobmV3IERhdGUoKS5nZXRGdWxsWWVhcigpKTtcclxuICBjb25zdCBbbW9udGhseUF0dGVuZGFuY2UsIHNldE1vbnRobHlBdHRlbmRhbmNlXSA9IHVzZVN0YXRlKFtdKTtcclxuICBjb25zdCBbaG9saWRheXMsIHNldEhvbGlkYXlzXSA9IHVzZVN0YXRlKFtdKTtcclxuICBjb25zdCBbc2V0dGluZ3MsIHNldFNldHRpbmdzXSA9IHVzZVN0YXRlKHt9KTtcclxuICBjb25zdCBbX2xvYWRpbmdBdHRlbmRhbmNlLCBzZXRMb2FkaW5nQXR0ZW5kYW5jZV0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcblxyXG4gIC8vIFJlcXVlc3RzIFRhYiBTdGF0ZVxyXG4gIGNvbnN0IFtyZXF1ZXN0cywgc2V0UmVxdWVzdHNdID0gdXNlU3RhdGUoW10pO1xyXG4gIGNvbnN0IFtyZXF1ZXN0Rm9ybSwgc2V0UmVxdWVzdEZvcm1dID0gdXNlU3RhdGUoe1xyXG4gICAgc3RhcnREYXRlOiAnJyxcclxuICAgIGVuZERhdGU6ICcnLFxyXG4gICAgY2hlY2tJbjogJycsXHJcbiAgICBjaGVja091dDogJycsXHJcbiAgICByZWFzb246ICcnXHJcbiAgfSk7XHJcbiAgY29uc3QgW3N1Ym1pdHRpbmdSZXF1ZXN0LCBzZXRTdWJtaXR0aW5nUmVxdWVzdF0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcblxyXG4gIC8vIEVmZmVjdHNcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKHBlcm1pc3Npb25Mb2FkaW5nIHx8ICFjYW5PcGVuQXR0ZW5kYW5jZSB8fCBvbmJvYXJkaW5nUGVuZGluZykgcmV0dXJuO1xyXG4gICAgaWYgKGFjdGl2ZVRhYiA9PT0gJ2F0dGVuZGFuY2UnKSB7XHJcbiAgICAgIGZldGNoTW9udGhseURhdGEoKTtcclxuICAgIH0gZWxzZSBpZiAoYWN0aXZlVGFiID09PSAncmVxdWVzdHMnKSB7XHJcbiAgICAgIGZldGNoUmVxdWVzdEhpc3RvcnkoKTtcclxuICAgIH1cclxuICB9LCBbYWN0aXZlVGFiLCBjdXJyZW50TW9udGgsIGN1cnJlbnRZZWFyLCBjYW5PcGVuQXR0ZW5kYW5jZSwgY2FuVmlld0F0dGVuZGFuY2UsIGNhblNlZVJlcXVlc3RIaXN0b3J5LCBwZXJtaXNzaW9uTG9hZGluZywgb25ib2FyZGluZ1BlbmRpbmddKTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmICghYXZhaWxhYmxlVGFicy5sZW5ndGgpIHJldHVybjtcclxuICAgIGlmICghYXZhaWxhYmxlVGFicy5pbmNsdWRlcyhhY3RpdmVUYWIpKSB7XHJcbiAgICAgIHNldEFjdGl2ZVRhYihhdmFpbGFibGVUYWJzWzBdKTtcclxuICAgIH1cclxuICB9LCBbYWN0aXZlVGFiLCBhdmFpbGFibGVUYWJzXSk7XHJcblxyXG4gIGNvbnN0IGZldGNoTW9udGhseURhdGEgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWNhblZpZXdBdHRlbmRhbmNlKSByZXR1cm47XHJcbiAgICB0cnkge1xyXG4gICAgICBzZXRMb2FkaW5nQXR0ZW5kYW5jZSh0cnVlKTtcclxuICAgICAgY29uc3QgW2F0dFJlcywgaG9saWRheVJlcywgc2V0dGluZ3NSZXNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xyXG4gICAgICAgIGFwaS5nZXQoYC9hdHRlbmRhbmNlL215P21vbnRoPSR7Y3VycmVudE1vbnRoICsgMX0meWVhcj0ke2N1cnJlbnRZZWFyfWApLFxyXG4gICAgICAgIGFwaS5nZXQoJy9ob2xpZGF5cycpLFxyXG4gICAgICAgIGFwaS5nZXQoJy9hdHRlbmRhbmNlL3NldHRpbmdzJylcclxuICAgICAgXSk7XHJcbiAgICAgIHNldE1vbnRobHlBdHRlbmRhbmNlKGF0dFJlcy5kYXRhIHx8IFtdKTtcclxuICAgICAgc2V0SG9saWRheXMoaG9saWRheVJlcy5kYXRhIHx8IFtdKTtcclxuICAgICAgc2V0U2V0dGluZ3Moc2V0dGluZ3NSZXMuZGF0YSB8fCB7fSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0TG9hZGluZ0F0dGVuZGFuY2UoZmFsc2UpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGZldGNoUmVxdWVzdEhpc3RvcnkgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWNhblNlZVJlcXVlc3RIaXN0b3J5KSByZXR1cm47XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBhcGkuZ2V0KCcvZW1wbG95ZWUvcmVndWxhcml6YXRpb24vbXknKTtcclxuICAgICAgc2V0UmVxdWVzdHMocmVzLmRhdGEuZGF0YSB8fCBbXSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGhhbmRsZVJlcXVlc3RTdWJtaXQgPSBhc3luYyAoZSkgPT4ge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgaWYgKCFjYW5DcmVhdGVBdHRlbmRhbmNlKSByZXR1cm47XHJcbiAgICBpZiAoIXJlcXVlc3RGb3JtLnN0YXJ0RGF0ZSB8fCAhcmVxdWVzdEZvcm0ucmVhc29uKSByZXR1cm47XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgc2V0U3VibWl0dGluZ1JlcXVlc3QodHJ1ZSk7XHJcbiAgICAgIGNvbnN0IHBheWxvYWQgPSB7XHJcbiAgICAgICAgY2F0ZWdvcnk6ICdBdHRlbmRhbmNlJyxcclxuICAgICAgICBzdGFydERhdGU6IHJlcXVlc3RGb3JtLnN0YXJ0RGF0ZSxcclxuICAgICAgICBlbmREYXRlOiByZXF1ZXN0Rm9ybS5lbmREYXRlIHx8IHJlcXVlc3RGb3JtLnN0YXJ0RGF0ZSxcclxuICAgICAgICBpc3N1ZVR5cGU6ICdSZWd1bGFyaXphdGlvbicsXHJcbiAgICAgICAgcmVhc29uOiByZXF1ZXN0Rm9ybS5yZWFzb24sXHJcbiAgICAgICAgcmVxdWVzdGVkRGF0YToge1xyXG4gICAgICAgICAgY2hlY2tJbjogcmVxdWVzdEZvcm0uY2hlY2tJbiA/IGAke3JlcXVlc3RGb3JtLnN0YXJ0RGF0ZX1UJHtyZXF1ZXN0Rm9ybS5jaGVja0lufTowMGAgOiBudWxsLFxyXG4gICAgICAgICAgY2hlY2tPdXQ6IHJlcXVlc3RGb3JtLmNoZWNrSW4gPyBgJHtyZXF1ZXN0Rm9ybS5zdGFydERhdGV9VCR7cmVxdWVzdEZvcm0uY2hlY2tJbn06MDBgIDogbnVsbCxcclxuICAgICAgICAgIHB1bmNoSW46IHJlcXVlc3RGb3JtLmNoZWNrSW4gPyBgJHtyZXF1ZXN0Rm9ybS5zdGFydERhdGV9VCR7cmVxdWVzdEZvcm0uY2hlY2tJbn06MDBgIDogbnVsbCxcclxuICAgICAgICAgIHB1bmNoT3V0OiByZXF1ZXN0Rm9ybS5jaGVja091dCA/IGAke3JlcXVlc3RGb3JtLnN0YXJ0RGF0ZX1UJHtyZXF1ZXN0Rm9ybS5jaGVja091dH06MDBgIDogbnVsbFxyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgICAgYXdhaXQgYXBpLnBvc3QoJy9lbXBsb3llZS9yZWd1bGFyaXphdGlvbicsIHBheWxvYWQpO1xyXG4gICAgICBhbGVydCgnQ29ycmVjdGlvbiByZXF1ZXN0IHN1Ym1pdHRlZCBzdWNjZXNzZnVsLicpO1xyXG4gICAgICBzZXRSZXF1ZXN0Rm9ybSh7IHN0YXJ0RGF0ZTogJycsIGVuZERhdGU6ICcnLCBjaGVja0luOiAnJywgY2hlY2tPdXQ6ICcnLCByZWFzb246ICcnIH0pO1xyXG4gICAgICBmZXRjaFJlcXVlc3RIaXN0b3J5KCk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgYWxlcnQoZXJyLnJlc3BvbnNlPy5kYXRhPy5lcnJvciB8fCAnU3VibWlzc2lvbiBmYWlsZWQnKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHNldFN1Ym1pdHRpbmdSZXF1ZXN0KGZhbHNlKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBnZXRTdGF0dXNCYWRnZSA9IChzdGF0dXMpID0+IHtcclxuICAgIGNvbnN0IHMgPSBzdGF0dXM/LnRvTG93ZXJDYXNlKCkgfHwgJ3BlbmRpbmcnO1xyXG4gICAgY29uc3QgYmFzZSA9IFwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjUgdGV4dC14cyBmb250LXNlbWlib2xkIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCBcIjtcclxuXHJcbiAgICBpZiAocyA9PT0gJ2FwcHJvdmVkJykgcmV0dXJuIChcclxuICAgICAgPHNwYW4gY2xhc3NOYW1lPXtiYXNlICsgXCJ0ZXh0LVsjMTZBMzRBXVwifT5cclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMS41IGgtMS41IHJvdW5kZWQtZnVsbCBiZy1bIzE2QTM0QV1cIj48L2Rpdj5cclxuICAgICAgICBBcHByb3ZlZFxyXG4gICAgICA8L3NwYW4+XHJcbiAgICApO1xyXG4gICAgaWYgKHMgPT09ICdyZWplY3RlZCcgfHwgcyA9PT0gJ2NhbmNlbGxlZCcpIHJldHVybiAoXHJcbiAgICAgIDxzcGFuIGNsYXNzTmFtZT17YmFzZSArIFwidGV4dC1bI0RDMjYyNl1cIn0+XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTEuNSBoLTEuNSByb3VuZGVkLWZ1bGwgYmctWyNEQzI2MjZdXCI+PC9kaXY+XHJcbiAgICAgICAge3MgPT09ICdyZWplY3RlZCcgPyAnUmVqZWN0ZWQnIDogJ0NhbmNlbGxlZCd9XHJcbiAgICAgIDwvc3Bhbj5cclxuICAgICk7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICA8c3BhbiBjbGFzc05hbWU9e2Jhc2UgKyBcInRleHQtWyNGNTlFMEJdXCJ9PlxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy0xLjUgaC0xLjUgcm91bmRlZC1mdWxsIGJnLVsjRjU5RTBCXSBhbmltYXRlLXB1bHNlXCI+PC9kaXY+XHJcbiAgICAgICAgUGVuZGluZ1xyXG4gICAgICA8L3NwYW4+XHJcbiAgICApO1xyXG4gIH07XHJcblxyXG4gIGlmIChwZXJtaXNzaW9uTG9hZGluZykge1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBpZiAoIWNhbk9wZW5BdHRlbmRhbmNlKSB7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggbWluLWgtWzMyMHB4XSBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgYmctd2hpdGUgcC02XCI+XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LWZ1bGwgbWF4LXcteGwgcm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1bI0UyRThGMF0gYmctd2hpdGUgcC04IHRleHQtY2VudGVyIHNoYWRvdy1zbVwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJteC1hdXRvIG1iLTIgZmxleCBoLTE0IHctMTQgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtMnhsIGJnLVsjRkVGMkYyXSB0ZXh0LVsjREMyNjI2XVwiPlxyXG4gICAgICAgICAgICA8QWxlcnRDaXJjbGUgc2l6ZT17Mjh9IC8+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LVsyMHB4XSBmb250LXNlbWlib2xkIHRleHQtc2xhdGUtOTAwXCI+QXR0ZW5kYW5jZSBBY2Nlc3MgUmVzdHJpY3RlZDwvaDM+XHJcbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJtdC0yIHRleHQteHMgZm9udC1tZWRpdW0gdGV4dC1bIzY0NzQ4Ql1cIj5cclxuICAgICAgICAgICAgWW91IGRvIG5vdCBjdXJyZW50bHkgaGF2ZSBwZXJtaXNzaW9uIHRvIG9wZW4gYXR0ZW5kYW5jZSBkYXRhIGZvciB0aGlzIHdvcmtzcGFjZS5cclxuICAgICAgICAgIDwvcD5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9kaXY+XHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgaWYgKG9uYm9hcmRpbmdQZW5kaW5nKSB7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggbWluLWgtWzMyMHB4XSBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgYmctd2hpdGUgcC02XCI+XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LWZ1bGwgbWF4LXcteGwgcm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1bI0UyRThGMF0gYmctd2hpdGUgcC04IHRleHQtY2VudGVyIHNoYWRvdy1zbVwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJteC1hdXRvIG1iLTIgZmxleCBoLTE0IHctMTQgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtMnhsIGJnLVsjRUZGNkZGXSB0ZXh0LVsjMjU2M0VCXVwiPlxyXG4gICAgICAgICAgICA8U2hpZWxkQ2hlY2sgc2l6ZT17Mjh9IC8+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LVsyMHB4XSBmb250LXNlbWlib2xkIHRleHQtc2xhdGUtOTAwXCI+RmluaXNoIE9uYm9hcmRpbmcgRmlyc3Q8L2gzPlxyXG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwibXQtMiB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtWyM2NDc0OEJdXCI+XHJcbiAgICAgICAgICAgIEF0dGVuZGFuY2UsIGxlYXZlIGhpc3RvcnksIGFuZCByZWd1bGFyaXphdGlvbiB3aWxsIHVubG9jayBhZnRlciBIUiBjb21wbGV0ZXMgeW91ciBhY2NvdW50IGFjdGl2YXRpb24uXHJcbiAgICAgICAgICA8L3A+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHJldHVybiAoXHJcbiAgICA8ZGl2IGNsYXNzTmFtZT1cImgtZnVsbCBtaW4taC0wIHctZnVsbCBiZy13aGl0ZSBmb250LWludGVyIGZsZXggZmxleC1jb2xcIj5cclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LWZ1bGwgZmxleCBtaW4taC0wIGZsZXgtMSBmbGV4LWNvbFwiPlxyXG5cclxuICAgICAgICB7LyogVGFicyBQb3J0YWxlZCB0byBIZWFkZXIgKi99XHJcbiAgICAgICAge2NyZWF0ZVBvcnRhbChcclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXJvdyBpdGVtcy1jZW50ZXIganVzdGlmeS1zdGFydCBtbC0yXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleFwiPlxyXG4gICAgICAgICAgICAgIHtjYW5WaWV3QXR0ZW5kYW5jZSAmJiAoXHJcbiAgICAgICAgICAgICAgICA8VGFiQnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgIGFjdGl2ZT17YWN0aXZlVGFiID09PSAnYXR0ZW5kYW5jZSd9XHJcbiAgICAgICAgICAgICAgICAgIGxhYmVsPVwiQXR0ZW5kYW5jZVwiXHJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IG5hdmlnYXRlKCcvZW1wbG95ZWUvYXR0ZW5kYW5jZT90YWI9YXR0ZW5kYW5jZScpfVxyXG4gICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgIHsoY2FuQXBwbHlMZWF2ZSB8fCBjYW5TZWVMZWF2ZUhpc3RvcnkpICYmIChcclxuICAgICAgICAgICAgICAgIDxUYWJCdXR0b25cclxuICAgICAgICAgICAgICAgICAgYWN0aXZlPXthY3RpdmVUYWIgPT09ICdsZWF2ZXMnfVxyXG4gICAgICAgICAgICAgICAgICBsYWJlbD1cIkxlYXZlc1wiXHJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IG5hdmlnYXRlKCcvZW1wbG95ZWUvYXR0ZW5kYW5jZT90YWI9bGVhdmVzJyl9XHJcbiAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgeyhjYW5DcmVhdGVBdHRlbmRhbmNlIHx8IGNhblNlZVJlcXVlc3RIaXN0b3J5KSAmJiAoXHJcbiAgICAgICAgICAgICAgICA8VGFiQnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgIGFjdGl2ZT17YWN0aXZlVGFiID09PSAncmVxdWVzdHMnfVxyXG4gICAgICAgICAgICAgICAgICBsYWJlbD1cIlJlcXVlc3RzXCJcclxuICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gbmF2aWdhdGUoJy9lbXBsb3llZS9hdHRlbmRhbmNlP3RhYj1yZXF1ZXN0cycpfVxyXG4gICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PixcclxuICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoci1oZWFkZXItcG9ydGFsLXRhcmdldCcpIHx8IGRvY3VtZW50LmJvZHlcclxuICAgICAgICApfVxyXG5cclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi1oLTAgZmxleC0xIG92ZXJmbG93LXktYXV0byBzY3JvbGwtc21vb3RoIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMCBbc2Nyb2xsYmFyLWd1dHRlcjpzdGFibGVdIHAtNFwiPlxyXG5cclxuICAgICAgICAgIHsvKiAtLS0gQVRURU5EQU5DRSBUQUIgLS0tICovfVxyXG4gICAgICAgICAge2FjdGl2ZVRhYiA9PT0gJ2F0dGVuZGFuY2UnICYmIChcclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICB7LyogTWV0cmljcyBSb3cgLSBTdGlja3kgKi99XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzdGlja3kgdG9wLVstMTZweF0gei0yMCAtbXgtNCBweC00IHB0LTEgcGItNCBiZy13aGl0ZS84MCBiYWNrZHJvcC1ibHVyLW1kIGJvcmRlci1iIGJvcmRlci1zbGF0ZS0xMDAgc2hhZG93LXNtIG1iLTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMyBnYXAtNFwiPlxyXG4gICAgICAgICAgICAgICAgICA8U3VtbWFyeUNhcmQgbGFiZWw9XCJQcmVzZW50IERheXNcIiB2YWx1ZT17c3RhdHMucHJlc2VudERheXN9IGljb249e0NoZWNrQ2lyY2xlfSBiZ1RpbnQ9XCJiZy1bI0VDRkRGNV1cIiB0ZXh0Q29sb3I9XCJ0ZXh0LVsjMTZBMzRBXVwiIC8+XHJcbiAgICAgICAgICAgICAgICAgIDxTdW1tYXJ5Q2FyZCBsYWJlbD1cIkFic2VudCBEYXlzXCIgdmFsdWU9e3N0YXRzLmFic2VudERheUNvdW50IHx8IDB9IGljb249e0FsZXJ0Q2lyY2xlfSBiZ1RpbnQ9XCJiZy1bI0ZFRjJGMl1cIiB0ZXh0Q29sb3I9XCJ0ZXh0LVsjREMyNjI2XVwiIC8+XHJcbiAgICAgICAgICAgICAgICAgIDxTdW1tYXJ5Q2FyZCBsYWJlbD1cIkxlYXZlcyBUYWtlblwiIHZhbHVlPXtzdGF0cy5sZWF2ZXNUYWtlbn0gaWNvbj17UGxhbmV9IGJnVGludD1cImJnLVsjRUZGNkZGXVwiIHRleHRDb2xvcj1cInRleHQtWyMyNTYzRUJdXCIgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICB7LyogU2hpZnQgSW5mb3JtYXRpb24gQmFubmVyICovfVxyXG4gICAgICAgICAgICAgIHtzZXR0aW5ncz8uZWZmZWN0aXZlU2hpZnQgJiYgKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmFkaWVudC10by1yIGZyb20tYmx1ZS01MCB0by1pbmRpZ28tNTAgcm91bmRlZC14bCBwLTQgYm9yZGVyIGJvcmRlci1ibHVlLTEwMC81MCBzaGFkb3ctc20gZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGFuaW1hdGUtaW4gZmFkZS1pbiBzbGlkZS1pbi1mcm9tLWJvdHRvbS0yIGR1cmF0aW9uLTUwMFwiPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTEwIGgtMTAgYmctd2hpdGUgcm91bmRlZC1sZyBzaGFkb3ctc20gZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgdGV4dC1ibHVlLTYwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPENsb2NrIHNpemU9ezIwfSAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LWJvbGQgdGV4dC1zbGF0ZS04MDBcIj57c2V0dGluZ3MuZWZmZWN0aXZlU2hpZnQubmFtZX08L2gzPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LXNsYXRlLTUwMFwiPllvdXIgY3VycmVudGx5IGFzc2lnbmVkIHNoaWZ0IHNjaGVkdWxlPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy13aGl0ZSBweC00IHB5LTIgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXNsYXRlLTEwMCBzaGFkb3ctc21cIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMiBoLTIgcm91bmRlZC1mdWxsIGJnLWVtZXJhbGQtNTAwIGFuaW1hdGUtcHVsc2VcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1ib2xkIHRleHQtc2xhdGUtNzAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtzZXR0aW5ncy5lZmZlY3RpdmVTaGlmdC5zdGFydFRpbWV9IHRvIHtzZXR0aW5ncy5lZmZlY3RpdmVTaGlmdC5lbmRUaW1lfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAge3NldHRpbmdzLmVmZmVjdGl2ZVNoaWZ0LmlzTmlnaHRTaGlmdCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cIm1sLTIgdGV4dC1bMTBweF0gZm9udC1ib2xkIGJnLWluZGlnby0xMDAgdGV4dC1pbmRpZ28tNjAwIHB4LTIgcHktMC41IHJvdW5kZWQtZnVsbCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXJcIj5OaWdodCBTaGlmdDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgPENsaWVudE1lZXRpbmdUcmFja2VyXHJcbiAgICAgICAgICAgICAgICBpc0NoZWNrZWRJbj17aXNDaGVja2VkSW59XHJcbiAgICAgICAgICAgICAgICBpc0NoZWNrZWRPdXQ9e2lzQ2hlY2tlZE91dH1cclxuICAgICAgICAgICAgICAgIHRvZGF5UmVjb3JkPXt0b2RheVJlY29yZH1cclxuICAgICAgICAgICAgICAgIGZldGNoRGFzaGJvYXJkRGF0YT17ZmV0Y2hEYXNoYm9hcmREYXRhfVxyXG4gICAgICAgICAgICAgIC8+XHJcblxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLVsjRTJFOEYwXSBzaGFkb3ctc20gb3ZlcmZsb3ctaGlkZGVuXCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB4LTQgcHQtMyBwYi00XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxBdHRlbmRhbmNlQ2FsZW5kYXJcclxuICAgICAgICAgICAgICAgICAgICBkYXRhPXttb250aGx5QXR0ZW5kYW5jZX1cclxuICAgICAgICAgICAgICAgICAgICBob2xpZGF5cz17aG9saWRheXN9XHJcbiAgICAgICAgICAgICAgICAgICAgbGVhdmVzPXtsZWF2ZXN9XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0dGluZ3M9e3NldHRpbmdzfVxyXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRNb250aD17Y3VycmVudE1vbnRofVxyXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRZZWFyPXtjdXJyZW50WWVhcn1cclxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJDb250cm9scz17XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0wLjUgYmctc2xhdGUtNTAgcHgtMC41IHB5LTAuNSByb3VuZGVkLWxnIGJvcmRlciBib3JkZXItWyNFMkU4RjBdXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4gc2V0Q3VycmVudFllYXIoeSA9PiB5IC0gMSl9IGNsYXNzTmFtZT1cImZsZXggaC02IHctNiBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgaG92ZXI6Ymctd2hpdGUgaG92ZXI6dGV4dC1bIzI1NjNFQl0gcm91bmRlZCB0cmFuc2l0aW9uLWFsbCB0ZXh0LVsjNjQ3NDhCXSBhY3RpdmU6c2NhbGUtOTBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIC1zcGFjZS14LTJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxDaGV2cm9uTGVmdCBzaXplPXsxMn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxDaGV2cm9uTGVmdCBzaXplPXsxMn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4geyBpZiAoY3VycmVudE1vbnRoID09PSAwKSB7IHNldEN1cnJlbnRNb250aCgxMSk7IHNldEN1cnJlbnRZZWFyKHkgPT4geSAtIDEpOyB9IGVsc2Ugc2V0Q3VycmVudE1vbnRoKG0gPT4gbSAtIDEpOyB9fSBjbGFzc05hbWU9XCJmbGV4IGgtNiB3LTYgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGhvdmVyOmJnLXdoaXRlIGhvdmVyOnRleHQtWyMyNTYzRUJdIHJvdW5kZWQgdHJhbnNpdGlvbi1hbGwgdGV4dC1bIzY0NzQ4Ql0gYWN0aXZlOnNjYWxlLTkwXCI+PENoZXZyb25MZWZ0IHNpemU9ezEzfSAvPjwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtc2VtaWJvbGQgdGV4dC1bIzMzNDE1NV0gdy0xOCB0ZXh0LWNlbnRlciB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXJcIj57ZGF5anMobmV3IERhdGUoY3VycmVudFllYXIsIGN1cnJlbnRNb250aCkpLmZvcm1hdCgnTU1NIFlZWVknKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4geyBpZiAoY3VycmVudE1vbnRoID09PSAxMSkgeyBzZXRDdXJyZW50TW9udGgoMCk7IHNldEN1cnJlbnRZZWFyKHkgPT4geSArIDEpOyB9IGVsc2Ugc2V0Q3VycmVudE1vbnRoKG0gPT4gbSArIDEpOyB9fSBjbGFzc05hbWU9XCJmbGV4IGgtNiB3LTYgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGhvdmVyOmJnLXdoaXRlIGhvdmVyOnRleHQtWyMyNTYzRUJdIHJvdW5kZWQgdHJhbnNpdGlvbi1hbGwgdGV4dC1bIzY0NzQ4Ql0gYWN0aXZlOnNjYWxlLTkwXCI+PENoZXZyb25SaWdodCBzaXplPXsxM30gLz48L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiBzZXRDdXJyZW50WWVhcih5ID0+IHkgKyAxKX0gY2xhc3NOYW1lPVwiZmxleCBoLTYgdy02IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBob3ZlcjpiZy13aGl0ZSBob3Zlcjp0ZXh0LVsjMjU2M0VCXSByb3VuZGVkIHRyYW5zaXRpb24tYWxsIHRleHQtWyM2NDc0OEJdIGFjdGl2ZTpzY2FsZS05MFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgLXNwYWNlLXgtMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPENoZXZyb25SaWdodCBzaXplPXsxMn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxDaGV2cm9uUmlnaHQgc2l6ZT17MTJ9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICB7LyogLS0tIExFQVZFUyBUQUIgLS0tICovfVxyXG4gICAgICAgICAge2FjdGl2ZVRhYiA9PT0gJ2xlYXZlcycgJiYgKFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNiBhbmltYXRlLWluIHNsaWRlLWluLWZyb20tYm90dG9tLTMgZHVyYXRpb24tNTAwXCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxTZWN0aW9uSGVhZGluZyB0aXRsZT1cIkxlYXZlIEJhbGFuY2VzXCIgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgIHtsYXN0TW9udGhBY2NydWFsICYmIChcclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ncmFkaWVudC10by1yIGZyb20taW5kaWdvLTUwLzgwIHZpYS1wdXJwbGUtNTAvNTAgdG8tcGluay01MC81MCBib3JkZXIgYm9yZGVyLWluZGlnby0xMDAvNjAgcm91bmRlZC0yeGwgcC00IG1iLTYgc2hhZG93LXNtXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtY29sIG1kOmZsZXgtcm93IG1kOml0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgbWItMS41XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidy0yIGgtMiByb3VuZGVkLWZ1bGwgYmctaW5kaWdvLTUwMCBhbmltYXRlLXB1bHNlXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8aDQgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LWJsYWNrIHVwcGVyY2FzZSB0cmFja2luZy13aWRlc3QgdGV4dC1pbmRpZ28tNzAwXCI+TW9udGhseSBBY2NydWFsIFN1bW1hcnk8L2g0PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gdGV4dC1zbGF0ZS01MDAgZm9udC1tZWRpdW0gbGVhZGluZy1ub3JtYWxcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBZb3VyIGxlYXZlcyBhcmUgY3JlZGl0ZWQgbW9udGhseSBiYXNlZCBvbiB5b3VyIGF0dGVuZGFuY2UuIEJlbG93IGlzIHRoZSBkZXRhaWxzIG9mIGxhc3QgbW9udGgncyBwcm9jZXNzaW5nLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIHtsZWF2ZVBvbGljeSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUvODAgYm9yZGVyIGJvcmRlci1zbGF0ZS0xMDAgcHgtMy41IHB5LTIgcm91bmRlZC14bFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzhweF0gZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXN0IHRleHQtc2xhdGUtNDAwIGJsb2NrIG1iLTAuNVwiPlBvbGljeSBGb3JtdWxhPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1ib2xkIHRleHQtc2xhdGUtNzAwIGZvbnQtbW9ub1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeygoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVsUnVsZSA9IGxlYXZlUG9saWN5LnJ1bGVzPy5maW5kKHIgPT4gci5sZWF2ZVR5cGUgPT09ICdFTCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZWxSdWxlICYmIGVsUnVsZS5hY2NydWFsRGVwZW5kc09uQXR0ZW5kYW5jZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVsUnVsZS5jb3VudFByZXNlbnQgIT09IGZhbHNlKSBwYXJ0cy5wdXNoKCdQJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVsUnVsZS5jb3VudE9uRHV0eSAhPT0gZmFsc2UpIHBhcnRzLnB1c2goJ09EJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVsUnVsZS5jb3VudENvbXBPZmYgIT09IGZhbHNlKSBwYXJ0cy5wdXNoKCdDTycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbFJ1bGUuY291bnRIb2xpZGF5ICE9PSBmYWxzZSkgcGFydHMucHVzaCgnUEgnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZWxSdWxlLmNvdW50V2Vla2x5T2ZmICE9PSBmYWxzZSkgcGFydHMucHVzaCgnV08nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZWxSdWxlLmNvdW50UGFpZExlYXZlKSBwYXJ0cy5wdXNoKCdQTCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBgKCR7cGFydHMuam9pbignICsgJyl9KSA+PSAke2VsUnVsZS5taW5BdHRlbmRhbmNlRGF5cyB8fCAyMH1gO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnKFAgKyBPRCArIENPICsgUEggKyBXTykgPj0gMjAnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkoKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTIgc206Z3JpZC1jb2xzLTQgZ2FwLTQgbXQtNCBwdC0zIGJvcmRlci10IGJvcmRlci1pbmRpZ28tMTAwLzMwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdoaXRlLzUwIHAtMi41IHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1pbmRpZ28tMTAwLzEwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzhweF0gZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXN0IHRleHQtc2xhdGUtNDAwIGJsb2NrXCI+Q3VycmVudCBCYWxhbmNlPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC1zbGF0ZS04MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7KChiYWxhbmNlcyB8fCBbXSkuZmluZChiID0+IGIubGVhdmVUeXBlID09PSAnRUwnKT8uYXZhaWxhYmxlID8/IDApfSBFTFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUvNTAgcC0yLjUgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLWluZGlnby0xMDAvMTBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bOHB4XSBmb250LWJsYWNrIHVwcGVyY2FzZSB0cmFja2luZy13aWRlc3QgdGV4dC1zbGF0ZS00MDAgYmxvY2tcIj5FbGlnaWJsZSBEYXlzIChMYXN0IE1vbnRoKTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LWJsYWNrIHRleHQtc2xhdGUtODAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2xhc3RNb250aEFjY3J1YWwuZWxpZ2libGVEYXlzICE9PSBudWxsID8gYCR7bGFzdE1vbnRoQWNjcnVhbC5lbGlnaWJsZURheXN9IERheXNgIDogJ04vQSd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy13aGl0ZS81MCBwLTIuNSByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItaW5kaWdvLTEwMC8xMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVs4cHhdIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVzdCB0ZXh0LXNsYXRlLTQwMCBibG9ja1wiPkVMIENyZWRpdGVkPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC1zbGF0ZS04MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7bGFzdE1vbnRoQWNjcnVhbC5kYXlzIHx8IDB9IEVMXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy13aGl0ZS81MCBwLTIuNSByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItaW5kaWdvLTEwMC8xMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVs4cHhdIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVzdCB0ZXh0LXNsYXRlLTQwMCBibG9ja1wiPlN0YXR1cyAvIENyaXRlcmlhPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9e2B0ZXh0LXhzIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyICR7bGFzdE1vbnRoQWNjcnVhbC5kYXlzID4gMCA/ICd0ZXh0LWluZGlnby02MDAnIDogJ3RleHQtc2xhdGUtNTAwJ31gfT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7bGFzdE1vbnRoQWNjcnVhbC5mb3JtdWxhQXBwbGllZCB8fCAnTi9BJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTIgbWQ6Z3JpZC1jb2xzLTMgbGc6Z3JpZC1jb2xzLTUgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgICAge2JhbGFuY2VzLm1hcCgoYiwgaSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGVMZWF2ZXMgPSBsZWF2ZXMuZmlsdGVyKGwgPT4gbC5sZWF2ZVR5cGUgPT09IGIubGVhdmVUeXBlKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VkID0gdHlwZUxlYXZlcy5maWx0ZXIobCA9PiBsLnN0YXR1cz8udG9Mb3dlckNhc2UoKSA9PT0gJ2FwcHJvdmVkJykucmVkdWNlKChhY2MsIGN1cnIpID0+IGFjYyArIChjdXJyLmRheXNDb3VudCB8fCAwKSwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGVuZGluZyA9IHR5cGVMZWF2ZXMuZmlsdGVyKGwgPT4gbC5zdGF0dXM/LnRvTG93ZXJDYXNlKCkgPT09ICdwZW5kaW5nJykucmVkdWNlKChhY2MsIGN1cnIpID0+IGFjYyArIChjdXJyLmRheXNDb3VudCB8fCAwKSwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVtYWluaW5nID0gYi5hdmFpbGFibGUgfHwgMDtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0b3RhbCA9IGIudG90YWwgfHwgKHVzZWQgKyByZW1haW5pbmcpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9ycyA9IHsgXHJcbiAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiAndGV4dC1zbGF0ZS02MDAnLCBcclxuICAgICAgICAgICAgICAgICAgICAgIGJnOiAnYmctc2xhdGUtNTAvNTAnLCBcclxuICAgICAgICAgICAgICAgICAgICAgIGJvcmRlcjogJ2JvcmRlci1zbGF0ZS0xMDAvNTAnLCBcclxuICAgICAgICAgICAgICAgICAgICAgIGFjY2VudDogJ2JnLXNsYXRlLTQwMCcgXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYga2V5PXtiLmxlYXZlVHlwZSB8fCBpfSBjbGFzc05hbWU9e2Nsc3goXCJiZy13aGl0ZSBib3JkZXIgcm91bmRlZC14bCBwLTMgc2hhZG93LXNtIGhvdmVyOnNoYWRvdy1tZCB0cmFuc2l0aW9uLWFsbCBncm91cCByZWxhdGl2ZSBvdmVyZmxvdy1oaWRkZW5cIiwgY29sb3JzLmJvcmRlcil9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7LyogQWNjZW50IEJhciAqL31cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e2Nsc3goXCJhYnNvbHV0ZSB0b3AtMCBsZWZ0LTAgdy0xIGgtZnVsbFwiLCBjb2xvcnMuYWNjZW50KX0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIG1iLTJcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVzdCB0ZXh0LXNsYXRlLTQwMFwiPntiLmxlYXZlVHlwZX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge3JlbWFpbmluZyA9PT0gMCA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIGZvbnQtYm9sZCBweC0yIHB5LTAuNSByb3VuZGVkLW1kIGJnLXNsYXRlLTEwMCB0ZXh0LXNsYXRlLTQwMFwiPkV4aGF1c3RlZDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPXtjbHN4KFwidGV4dC1bMTBweF0gZm9udC1ib2xkIHB4LTIgcHktMC41IHJvdW5kZWQtbWRcIiwgY29sb3JzLmJnLCBjb2xvcnMudGV4dCl9PkF2YWlsYWJsZTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1iYXNlbGluZSBnYXAtMS41IG1iLTRcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LTJ4bCBmb250LWJsYWNrIHRleHQtc2xhdGUtODAwIGxlYWRpbmctbm9uZVwiPntyZW1haW5pbmd9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1ib2xkIHRleHQtc2xhdGUtNDAwXCI+VW5pdHM8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtd3JhcCBnYXAtMiBwdC0yIGJvcmRlci10IGJvcmRlci1zbGF0ZS01MFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEuNSBiZy1zbGF0ZS01MCBweC0yIHB5LTEgcm91bmRlZC1tZFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bOHB4XSBmb250LWJsYWNrIHRleHQtc2xhdGUtNDAwIHVwcGVyY2FzZVwiPlRvdDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1ib2xkIHRleHQtc2xhdGUtNzAwXCI+e3RvdGFsfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjUgYmctZW1lcmFsZC01MC81MCBweC0yIHB5LTEgcm91bmRlZC1tZFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bOHB4XSBmb250LWJsYWNrIHRleHQtZW1lcmFsZC00MDAgdXBwZXJjYXNlXCI+VXNlPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyBmb250LWJvbGQgdGV4dC1lbWVyYWxkLTYwMFwiPnt1c2VkfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjUgYmctYW1iZXItNTAvNTAgcHgtMiBweS0xIHJvdW5kZWQtbWRcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzhweF0gZm9udC1ibGFjayB0ZXh0LWFtYmVyLTQwMCB1cHBlcmNhc2VcIj5XYWl0PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPXtjbHN4KFwidGV4dC14cyBmb250LWJvbGRcIiwgcGVuZGluZyA+IDAgPyBcInRleHQtYW1iZXItNTAwXCIgOiBcInRleHQtc2xhdGUtMzAwXCIpfT57cGVuZGluZ308L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgfSl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIHsvKiBTdWItdGFiIHRvZ2dsZSBmb3IgQXBwbHkgLyBFbmNhc2htZW50ICovfVxyXG4gICAgICAgICAgICB7ZW5jYXNoQ29uZmlnPy5hbGxvd2VkICYmIChcclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZ2FwLTIgbWItNFwiPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRMZWF2ZXNTdWJUYWIoJ2FwcGx5Jyl9XHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y2xzeChcImZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjUgcHgtNCBweS0yIHJvdW5kZWQteGwgdGV4dC14cyBmb250LWJsYWNrIHVwcGVyY2FzZSB0cmFja2luZy13aWRlIHRyYW5zaXRpb24tYWxsXCIsIFxyXG4gICAgICAgICAgICAgICAgICAgIGxlYXZlc1N1YlRhYiA9PT0gJ2FwcGx5JyA/ICdiZy1zbGF0ZS05MDAgdGV4dC13aGl0ZSBzaGFkb3ctbWQnIDogJ2JnLXdoaXRlIHRleHQtc2xhdGUtNTAwIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIGhvdmVyOmJvcmRlci1zbGF0ZS0zMDAnKX1cclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgPFBsYW5lIHNpemU9ezEyfSAvPiBBcHBseSBMZWF2ZVxyXG4gICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldExlYXZlc1N1YlRhYignZW5jYXNobWVudCcpfVxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2Nsc3goXCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMS41IHB4LTQgcHktMiByb3VuZGVkLXhsIHRleHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZSB0cmFuc2l0aW9uLWFsbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIGxlYXZlc1N1YlRhYiA9PT0gJ2VuY2FzaG1lbnQnID8gJ2JnLWluZGlnby02MDAgdGV4dC13aGl0ZSBzaGFkb3ctbWQnIDogJ2JnLXdoaXRlIHRleHQtc2xhdGUtNTAwIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIGhvdmVyOmJvcmRlci1zbGF0ZS0zMDAnKX1cclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgPERvbGxhclNpZ24gc2l6ZT17MTJ9IC8+IExlYXZlIEVuY2FzaG1lbnRcclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAge2xlYXZlc1N1YlRhYiA9PT0gJ2FwcGx5JyAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIGxnOmdyaWQtY29scy0xMiBnYXAtNiBpdGVtcy1zdGFydFwiPlxyXG4gICAgICAgICAgICAgICAgey8qIEFwcGx5IEZvcm0gKi99XHJcbiAgICAgICAgICAgICAgICB7Y2FuQXBwbHlMZWF2ZSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibGc6Y29sLXNwYW4tNVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxTZWN0aW9uSGVhZGluZyB0aXRsZT1cIkFwcGx5IGZvciBMZWF2ZVwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPEFwcGx5TGVhdmVGb3JtXHJcbiAgICAgICAgICAgICAgICAgICAgICBiYWxhbmNlcz17YmFsYW5jZXN9XHJcbiAgICAgICAgICAgICAgICAgICAgICBleGlzdGluZ0xlYXZlcz17bGVhdmVzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgZWRpdERhdGE9e2VkaXRMZWF2ZX1cclxuICAgICAgICAgICAgICAgICAgICAgIG9uU3VjY2Vzcz17KCkgPT4geyBzZXRFZGl0TGVhdmUobnVsbCk7IGZldGNoRGFzaGJvYXJkRGF0YSgpOyB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgb25DYW5jZWxFZGl0PXsoKSA9PiBzZXRFZGl0TGVhdmUobnVsbCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICBwcm9maWxlPXtwcm9maWxlfVxyXG4gICAgICAgICAgICAgICAgICAgICAgbGVhdmVQb2xpY3k9e2VmZmVjdGl2ZUxlYXZlUG9saWN5fVxyXG4gICAgICAgICAgICAgICAgICAgICAgaGFzTGVhdmVQb2xpY3k9e2hhc0xlYXZlUG9saWN5fVxyXG4gICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgICB7LyogSGlzdG9yeSAqL31cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPXtjbHN4KFwibGc6Y29sLXNwYW4tN1wiLCAhY2FuQXBwbHlMZWF2ZSAmJiBcImxnOmNvbC1zcGFuLTEyXCIpfT5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gbWItMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxTZWN0aW9uSGVhZGluZyB0aXRsZT1cIkxlYXZlIEFjdGl2aXR5XCIgLz5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtWyM2NDc0OEJdIGJnLXNsYXRlLTEwMCBweC0zIHB5LTEgcm91bmRlZC1mdWxsXCI+e2xlYXZlcy5sZW5ndGh9IFRvdGFsPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgeyFjYW5TZWVMZWF2ZUhpc3RvcnkgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdoaXRlIGJvcmRlciBib3JkZXItZGFzaGVkIGJvcmRlci1bI0UyRThGMF0gcm91bmRlZC14bCBweS0xNiBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB0ZXh0LWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8QWxlcnRDaXJjbGUgc2l6ZT17Mjh9IGNsYXNzTmFtZT1cIm1iLTEuNSB0ZXh0LXNsYXRlLTMwMFwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIGZvbnQtbWVkaXVtIHRleHQtWyM2NDc0OEJdIHVwcGVyY2FzZSB0cmFja2luZy13aWRlclwiPkhpc3RvcnkgaGlkZGVuIGJ5IGFjY2VzcyBjb250cm9sPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKSA6IGxlYXZlcy5sZW5ndGggPiAwID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgWy4uLmxlYXZlc10uc29ydCgoYSwgYikgPT4gbmV3IERhdGUoYi5zdGFydERhdGUpIC0gbmV3IERhdGUoYS5zdGFydERhdGUpKS5tYXAoKGxlYXZlLCBpKSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYga2V5PXtpfSBvbkNsaWNrPXsoKSA9PiBzZXRTZWxlY3RlZExlYXZlKGxlYXZlKX0gY2xhc3NOYW1lPVwiYmctd2hpdGUgcC00IHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1bI0UyRThGMF0gc2hhZG93LXNtIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtNiBob3ZlcjpzaGFkb3ctbWQgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwIGN1cnNvci1wb2ludGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTEyIGgtMTIgYmctd2hpdGUgYm9yZGVyIGJvcmRlci1bI0UyRThGMF0gcm91bmRlZC1sZyBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB0ZXh0LVsjMzM0MTU1XVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVs5cHhdIHVwcGVyY2FzZSBmb250LXNlbWlib2xkIHRleHQtWyM2NDc0OEJdIG9wYWNpdHktNjAgbGVhZGluZy1ub25lIG1iLTFcIj57ZGF5anMobGVhdmUuc3RhcnREYXRlKS5mb3JtYXQoJ01NTScpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMThweF0gZm9udC1zZW1pYm9sZCBsZWFkaW5nLW5vbmVcIj57ZGF5anMobGVhdmUuc3RhcnREYXRlKS5mb3JtYXQoJ0REJyl9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIG1iLTAuNVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtYm9sZCB0ZXh0LVsjMzM0MTU1XVwiPntsZWF2ZS5sZWF2ZVR5cGV9PC9oND5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7bGVhdmUuaXNIYWxmRGF5ICYmIGxlYXZlLmhhbGZEYXlTZXNzaW9uICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImJnLWJsdWUtNTAgdGV4dC1ibHVlLTYwMCBweC0xLjUgcHktMC41IHJvdW5kZWQgdGV4dC1bOXB4XSBmb250LWJvbGQgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtsZWF2ZS5oYWxmRGF5U2Vzc2lvbn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyB0ZXh0LXhzIHRleHQtWyM2NDc0OEJdXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPENhbGVuZGFySWNvbiBzaXplPXsxMn0gY2xhc3NOYW1lPVwib3BhY2l0eS00MFwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0RGF0ZURETU1ZWVlZKGxlYXZlLnN0YXJ0RGF0ZSl9IHtsZWF2ZS5lbmREYXRlICYmIGxlYXZlLmVuZERhdGUgIT09IGxlYXZlLnN0YXJ0RGF0ZSA/IGDihpIgJHtmb3JtYXREYXRlRERNTVlZWVkobGVhdmUuZW5kRGF0ZSl9YCA6ICcnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWyMyNTYzRUJdIGZvbnQtc2VtaWJvbGQgdHJhY2tpbmctdGlnaHRcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtsZWF2ZS5kYXlzQ291bnR9IDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzhweF0gZm9udC1tZWRpdW0gdXBwZXJjYXNlIG9wYWNpdHktNjAgbWwtMC41XCI+e2xlYXZlLmRheXNDb3VudCA9PT0gMSA/ICdEYXknIDogJ0RheXMnfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTZcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBpdGVtcy1lbmQgZ2FwLTEgcHgtMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Z2V0U3RhdHVzQmFkZ2UobGVhdmUuc3RhdHVzKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyhsZWF2ZS5hcHByb3ZlZEF0IHx8IGxlYXZlLnJlamVjdGVkQXQgfHwgbGVhdmUuY2FuY2VsbGVkQXQpICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVs5cHhdIGZvbnQtc2VtaWJvbGQgdGV4dC1zbGF0ZS00MDAgb3BhY2l0eS02MCB1cHBlcmNhc2UgdHJhY2tpbmctdGlnaHRlciBtdC0wLjVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtkYXlqcyhsZWF2ZS5hcHByb3ZlZEF0IHx8IGxlYXZlLnJlamVjdGVkQXQgfHwgbGVhdmUuY2FuY2VsbGVkQXQpLmZvcm1hdCgnREQtTU0tWVlZWSBISDptbScpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2NhbkRlbGV0ZUF0dGVuZGFuY2UgJiYgbGVhdmUuc3RhdHVzPy50b0xvd2VyQ2FzZSgpID09PSAncGVuZGluZycgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eyhlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlQ2FuY2VsTGVhdmU/LihsZWF2ZS5faWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctOSBoLTkgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgYmctWyNGRUYyRjJdIHRleHQtWyNEQzI2MjZdIHJvdW5kZWQtbGcgaG92ZXI6YmctWyNEQzI2MjZdIGhvdmVyOnRleHQtd2hpdGUgdHJhbnNpdGlvbi1hbGwgc2hhZG93LXNtIGFjdGl2ZTpzY2FsZS05NVwiIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiQ2FuY2VsIFJlcXVlc3RcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPFhDaXJjbGUgc2l6ZT17MTh9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjYW5FZGl0QXR0ZW5kYW5jZSAmJiBsZWF2ZS5zdGF0dXMgPT09ICdBcHByb3ZlZCcgJiYgZGF5anMoKS5pc0JlZm9yZShkYXlqcyhsZWF2ZS5lbmREYXRlKS5lbmRPZignZGF5JykpICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eyhlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRFYXJseVJldHVybk1vZGFsKHsgaXNPcGVuOiB0cnVlLCBsZWF2ZUlkOiBsZWF2ZS5faWQsIGxlYXZlRGF0YTogbGVhdmUsIG5ld0VuZERhdGU6IGRheWpzKCkuZm9ybWF0KCdZWVlZLU1NLUREJykgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LTkgaC05IGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJnLWJsdWUtNTAgdGV4dC1ibHVlLTYwMCByb3VuZGVkLWxnIGhvdmVyOmJnLWJsdWUtNjAwIGhvdmVyOnRleHQtd2hpdGUgdHJhbnNpdGlvbi1hbGwgc2hhZG93LXNtIGFjdGl2ZTpzY2FsZS05NVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiRWFybHkgUmV0dXJuIC8gUGFydGlhbCBDYW5jZWxcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8SGlzdG9yeSBzaXplPXsxNn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICApKVxyXG4gICAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdoaXRlIGJvcmRlciBib3JkZXItZGFzaGVkIGJvcmRlci1bI0UyRThGMF0gcm91bmRlZC14bCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBweS0yMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8RW1wdHkgaW1hZ2U9e0VtcHR5LlBSRVNFTlRFRF9JTUFHRV9TSU1QTEV9IGRlc2NyaXB0aW9uPXs8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsjNjQ3NDhCXSB0ZXh0LXhzIGZvbnQtbWVkaXVtXCI+Tm8gcmVjb3JkcyBmb3VuZDwvc3Bhbj59IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAge2xlYXZlc1N1YlRhYiA9PT0gJ2VuY2FzaG1lbnQnICYmIGVuY2FzaENvbmZpZz8uYWxsb3dlZCAmJiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTYgYW5pbWF0ZS1pbiBzbGlkZS1pbi1mcm9tLWJvdHRvbS0zIGR1cmF0aW9uLTMwMFwiPlxyXG4gICAgICAgICAgICAgICAge2VuY2FzaExvYWRpbmcgPyAoXHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHktMTIgdGV4dC1jZW50ZXIgdGV4dC1zbGF0ZS00MDAgdGV4dC14cyBmb250LWJvbGRcIj5Mb2FkaW5nLi4uPC9kaXY+XHJcbiAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbGc6Z3JpZC1jb2xzLTEyIGdhcC02IGl0ZW1zLXN0YXJ0XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgey8qIExlZnQ6IEFwcGx5IEZvcm0gKi99XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJsZzpjb2wtc3Bhbi01IHNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgey8qIFBvbGljeSBJbmZvIENhcmQgKi99XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdoaXRlIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIHJvdW5kZWQteGwgcC01IHNoYWRvdy1zbSBzcGFjZS15LTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cImZvbnQtZXh0cmFib2xkIHRleHQtc2xhdGUtODAwIHRleHQteHMgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8SW5mbyBzaXplPXsxNH0gY2xhc3NOYW1lPVwidGV4dC1pbmRpZ28tNTAwXCIvPiBFbmNhc2htZW50IFBvbGljeSBkZXRhaWxzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvaDM+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctaW5kaWdvLTUwLzUwIGJvcmRlciBib3JkZXItaW5kaWdvLTEwMCByb3VuZGVkLXhsIHAtNCBzcGFjZS15LTIgdGV4dC14c1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW5cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNTAwXCI+QWxsb3dlZCBMZWF2ZSBUeXBlPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ibGFjayB0ZXh0LWluZGlnby03MDBcIj57ZW5jYXNoQ29uZmlnLmxlYXZlVHlwZX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlblwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS01MDBcIj5NYXggRW5jYXNoYWJsZSBEYXlzL1llYXI8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJsYWNrIHRleHQtaW5kaWdvLTcwMFwiPntlbmNhc2hDb25maWcubWF4RW5jYXNoYWJsZURheXN9IERheXM8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlblwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS01MDBcIj5NaW4gQmFsYW5jZSB0byBSZXRhaW48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJsYWNrIHRleHQtaW5kaWdvLTcwMFwiPntlbmNhc2hDb25maWcubWluQmFsYW5jZVJldGFpbn0gRGF5czwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTUwMFwiPkZvcm11bGE8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJsYWNrIHRleHQtaW5kaWdvLTcwMFwiPntlbmNhc2hDb25maWcuZm9ybXVsYX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2VuY2FzaENvbmZpZy50YXhSdWxlICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWJldHdlZW4gYm9yZGVyLXQgYm9yZGVyLWluZGlnby0xMDAvNTAgcHQtMiBtdC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNTAwXCI+VGF4IFJ1bGU8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYmxhY2sgdGV4dC1zbGF0ZS03MDBcIj57ZW5jYXNoQ29uZmlnLnRheFJ1bGV9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICB7LyogUmVxdWVzdCBGb3JtICovfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy13aGl0ZSBib3JkZXIgYm9yZGVyLXNsYXRlLTIwMCByb3VuZGVkLXhsIHAtNSBzaGFkb3ctc20gc3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJmb250LWV4dHJhYm9sZCB0ZXh0LXNsYXRlLTgwMCB0ZXh0LXhzIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMS41XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPERvbGxhclNpZ24gc2l6ZT17MTR9IGNsYXNzTmFtZT1cInRleHQtaW5kaWdvLTUwMFwiLz4gUmVxdWVzdCBFbmNhc2htZW50XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvaDM+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbmNhc2hhYmxlQmFsYW5jZSA9IGJhbGFuY2VzLmZpbmQoYiA9PiBiLmxlYXZlVHlwZSA9PT0gZW5jYXNoQ29uZmlnLmxlYXZlVHlwZS50b1VwcGVyQ2FzZSgpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhdmFpbGFibGVEYXlzID0gZW5jYXNoYWJsZUJhbGFuY2UgPyAoZW5jYXNoYWJsZUJhbGFuY2UuYXZhaWxhYmxlIHx8IDApIDogMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXlzTnVtID0gcGFyc2VJbnQoZW5jYXNoRm9ybS5kYXlzKSB8fCAwO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWxpZGF0aW9uRXJyb3IgPSAoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRheXNOdW0gPD0gMCkgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF5c051bSA+IChlbmNhc2hDb25maWc/Lm1heEVuY2FzaGFibGVEYXlzIHx8IDApKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBgTWF4aW11bSBlbmNhc2hhYmxlIGRheXMgaXMgJHtlbmNhc2hDb25maWc/Lm1heEVuY2FzaGFibGVEYXlzfS5gO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF2YWlsYWJsZURheXMgLSBkYXlzTnVtIDwgKGVuY2FzaENvbmZpZz8ubWluQmFsYW5jZVJldGFpbiB8fCAwKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYFlvdSBtdXN0IHJldGFpbiBhdCBsZWFzdCAke2VuY2FzaENvbmZpZz8ubWluQmFsYW5jZVJldGFpbn0gZGF5cyBvZiAke2VuY2FzaENvbmZpZz8ubGVhdmVUeXBlfSBiYWxhbmNlLiAoQ3VycmVudDogJHthdmFpbGFibGVEYXlzfSwgUmV0YWluZWQ6ICR7YXZhaWxhYmxlRGF5cyAtIGRheXNOdW19KWA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9KSgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXlvdXRBbW91bnQgPSBkYXlzTnVtID4gMCAmJiBiYXNpY1NhbGFyeSA+IDAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IE1hdGgucm91bmQoKGJhc2ljU2FsYXJ5IC8gMzApICogZGF5c051bSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogMDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxmb3JtIG9uU3VibWl0PXtoYW5kbGVFbmNhc2hTdWJtaXR9IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXNsYXRlLTUwLzUwIGJvcmRlciBib3JkZXItc2xhdGUtMTAwIHJvdW5kZWQteGwgcC0zIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiB0ZXh0LXhzXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS01MDBcIj5Zb3VyIHtlbmNhc2hDb25maWcubGVhdmVUeXBlfSBCYWxhbmNlOjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJsYWNrIHRleHQtZW1lcmFsZC02MDBcIj57YXZhaWxhYmxlRGF5c30gRGF5czwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdGV4dC1zbGF0ZS01MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyXCI+RGF5cyB0byBFbmNhc2ggKjwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwibnVtYmVyXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbj1cIjFcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4PXtlbmNhc2hDb25maWc/Lm1heEVuY2FzaGFibGVEYXlzIHx8IDMwfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2VuY2FzaEZvcm0uZGF5c31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHNldEVuY2FzaEZvcm0ocHJldiA9PiAoeyAuLi5wcmV2LCBkYXlzOiBlLnRhcmdldC52YWx1ZSB9KSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj17YE1heCAke2VuY2FzaENvbmZpZz8ubWF4RW5jYXNoYWJsZURheXMgfHwgMH0gZGF5c2B9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgaC0xMCBweC0zIGJnLXNsYXRlLTUwIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIHJvdW5kZWQtbGcgdGV4dC14cyBmb250LWJvbGQgdGV4dC1zbGF0ZS03MDAgb3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1pbmRpZ28tNTAwIHRyYW5zaXRpb24tYWxsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7LyogTGl2ZSBwYXlvdXQgcHJldmlldyAqL31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2RheXNOdW0gPiAwICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWVtZXJhbGQtNTAgYm9yZGVyIGJvcmRlci1lbWVyYWxkLTEwMCByb3VuZGVkLXhsIHAtMy41IHNwYWNlLXktMiBhbmltYXRlLWluIGZhZGUtaW4gZHVyYXRpb24tMjAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIGl0ZW1zLWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTUwMCB0ZXh0LXhzXCI+RXN0aW1hdGVkIFBheW91dDo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1ibGFjayB0ZXh0LWVtZXJhbGQtNzAwXCI+4oK5e3BheW91dEFtb3VudC50b0xvY2FsZVN0cmluZygpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2Jhc2ljU2FsYXJ5ID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtWzEwcHhdIHRleHQtc2xhdGUtNDAwIGZvbnQtbWVkaXVtIGxlYWRpbmctbm9ybWFsXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2FsY3VsYXRpb246IOKCuXtiYXNpY1NhbGFyeS50b0xvY2FsZVN0cmluZygpfSAoQmFzaWMpIMO3IDMwIMOXIHtkYXlzTnVtfSBEYXlzID0g4oK5e3BheW91dEFtb3VudC50b0xvY2FsZVN0cmluZygpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gdGV4dC1zbGF0ZS00MDAgaXRhbGljXCI+RXhhY3QgcGF5b3V0IHdpbGwgYmUgdmVyaWZpZWQgYW5kIGFwcHJvdmVkIGJ5IEhSLjwvcD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt2YWxpZGF0aW9uRXJyb3IgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctcm9zZS01MCBib3JkZXIgYm9yZGVyLXJvc2UtMTAwIHJvdW5kZWQteGwgcC0zIHRleHQtWzExcHhdIGZvbnQtc2VtaWJvbGQgdGV4dC1yb3NlLTYwMCBmbGV4IGl0ZW1zLXN0YXJ0IGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8QWxlcnRDaXJjbGUgc2l6ZT17MTR9IGNsYXNzTmFtZT1cIm10LTAuNSBmbGV4LXNocmluay0wXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPnt2YWxpZGF0aW9uRXJyb3J9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtc2xhdGUtNTAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlclwiPlJlYXNvbiAoT3B0aW9uYWwpPC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3M9ezJ9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17ZW5jYXNoRm9ybS5yZWFzb259XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiBzZXRFbmNhc2hGb3JtKHByZXYgPT4gKHsgLi4ucHJldiwgcmVhc29uOiBlLnRhcmdldC52YWx1ZSB9KSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlByb3ZpZGUgYSByZWFzb24gZm9yIGVuY2FzaG1lbnQgcmVxdWVzdC4uLlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcHgtMyBweS0yIGJnLXNsYXRlLTUwIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIHJvdW5kZWQtbGcgdGV4dC14cyB0ZXh0LXNsYXRlLTcwMCBvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLWluZGlnby01MDAgdHJhbnNpdGlvbi1hbGwgcmVzaXplLW5vbmVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJzdWJtaXRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtlbmNhc2hTdWJtaXR0aW5nIHx8ICEhdmFsaWRhdGlvbkVycm9yIHx8IGRheXNOdW0gPD0gMH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcHktMi41IGJnLWluZGlnby02MDAgaG92ZXI6YmctaW5kaWdvLTcwMCB0ZXh0LXdoaXRlIHRleHQtWzEwcHhdIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVzdCByb3VuZGVkLXhsIHRyYW5zaXRpb24tYWxsIHNoYWRvdy1tZCBkaXNhYmxlZDpvcGFjaXR5LTUwIGRpc2FibGVkOmN1cnNvci1ub3QtYWxsb3dlZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZW5jYXNoU3VibWl0dGluZyA/ICdTdWJtaXR0aW5nLi4uJyA6ICdTdWJtaXQgRW5jYXNobWVudCBSZXF1ZXN0J31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Zvcm0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSkoKX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgICAgICAgICB7LyogUmlnaHQ6IFJlcXVlc3QgSGlzdG9yeSAqL31cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImxnOmNvbC1zcGFuLTdcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgcm91bmRlZC14bCBwLTUgc2hhZG93LXNtIHNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwiZm9udC1leHRyYWJvbGQgdGV4dC1zbGF0ZS04MDAgdGV4dC14cyB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXIgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEuNVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxIaXN0b3J5IHNpemU9ezE0fSBjbGFzc05hbWU9XCJ0ZXh0LWluZGlnby01MDBcIi8+IE15IEVuY2FzaG1lbnQgUmVxdWVzdHNcclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9oMz5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2VuY2FzaFJlcXVlc3RzLmxlbmd0aCA9PT0gMCA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB5LTE2IGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtc2xhdGUtNDAwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LTN4bCBtYi0yXCI+8J+SsDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1ib2xkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciB0ZXh0LXNsYXRlLTQwMFwiPk5vIGVuY2FzaG1lbnQgcmVxdWVzdHMgeWV0PC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZW5jYXNoUmVxdWVzdHMubWFwKHJlcSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXR1c0NvbG9yID0geyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBQZW5kaW5nOiAnYmctYW1iZXItNTAgdGV4dC1hbWJlci02MDAgYm9yZGVyLWFtYmVyLTEwMCcsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFwcHJvdmVkOiAnYmctZW1lcmFsZC01MCB0ZXh0LWVtZXJhbGQtNjAwIGJvcmRlci1lbWVyYWxkLTEwMCcsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJlamVjdGVkOiAnYmctcm9zZS01MCB0ZXh0LXJvc2UtNjAwIGJvcmRlci1yb3NlLTEwMCcsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENhbmNlbGxlZDogJ2JnLXNsYXRlLTEwMCB0ZXh0LXNsYXRlLTUwMCBib3JkZXItc2xhdGUtMjAwJyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVtyZXEuc3RhdHVzXSB8fCAnYmctc2xhdGUtMTAwIHRleHQtc2xhdGUtNTAwIGJvcmRlci1zbGF0ZS0yMDAnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYga2V5PXtyZXEuX2lkfSBjbGFzc05hbWU9XCJib3JkZXIgYm9yZGVyLXNsYXRlLTEwMCByb3VuZGVkLXhsIHAtNCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZ2FwLTQgaG92ZXI6Ym9yZGVyLXNsYXRlLTIwMCB0cmFuc2l0aW9uLWFsbFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTEuNSBmbGV4LTEgbWluLXctMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIGZsZXgtd3JhcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtZXh0cmFib2xkIHRleHQtc2xhdGUtODAwIHRleHQteHNcIj57cmVxLnJlcXVlc3RlZERheXN9IERheXMgKHtyZXEubGVhdmVUeXBlfSk8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPXtjbHN4KFwicHgtMiBweS0wLjUgcm91bmRlZCB0ZXh0LVs5cHhdIGZvbnQtYmxhY2sgdXBwZXJjYXNlIGJvcmRlclwiLCBzdGF0dXNDb2xvcil9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3JlcS5zdGF0dXN9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0yIGdhcC14LTQgZ2FwLXktMSB0ZXh0LVsxMXB4XSB0ZXh0LXNsYXRlLTUwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+QXZhaWxhYmxlOiA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1zbGF0ZS03MDBcIj57cmVxLmF2YWlsYWJsZUJhbGFuY2V9IERheXM8L3NwYW4+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdj5QYXlvdXQ6IDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYm9sZCB0ZXh0LWVtZXJhbGQtNjAwXCI+4oK5eyhyZXEucGF5b3V0QW1vdW50IHx8IDApLnRvTG9jYWxlU3RyaW5nKCl9PC9zcGFuPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtyZXEucmVhc29uICYmIDxkaXYgY2xhc3NOYW1lPVwiY29sLXNwYW4tMiB0ZXh0LXNsYXRlLTQwMCBpdGFsaWMgdHJ1bmNhdGUgbXQtMC41XCI+UmVhc29uOiBcIntyZXEucmVhc29ufVwiPC9kaXY+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtyZXEuYWRtaW5SZW1hcmsgJiYgPGRpdiBjbGFzc05hbWU9XCJjb2wtc3Bhbi0yIHRleHQtaW5kaWdvLTYwMCBmb250LXNlbWlib2xkIG10LTAuNVwiPkhSIFJlbWFyazogXCJ7cmVxLmFkbWluUmVtYXJrfVwiPC9kaXY+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSB0ZXh0LXNsYXRlLTQwMCBmb250LW1lZGl1bVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJlcXVlc3RlZCBvbjoge2RheWpzKHJlcS5jcmVhdGVkQXQpLmZvcm1hdCgnREQtTU0tWVlZWSBISDptbScpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3JlcS5zdGF0dXMgPT09ICdQZW5kaW5nJyAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVFbmNhc2hDYW5jZWwocmVxLl9pZCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2VuY2FzaENhbmNlbGxpbmcgPT09IHJlcS5faWR9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtMyBweS0xLjUgYm9yZGVyIGJvcmRlci1yb3NlLTIwMCBob3ZlcjpiZy1yb3NlLTUwIHJvdW5kZWQtbGcgdGV4dC1bMTBweF0gZm9udC1ibGFjayB0ZXh0LXJvc2UtNTAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciB0cmFuc2l0aW9uLWFsbCBkaXNhYmxlZDpvcGFjaXR5LTUwXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtlbmNhc2hDYW5jZWxsaW5nID09PSByZXEuX2lkID8gJy4uLicgOiAnQ2FuY2VsJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICl9XHJcbiAgICAgICAgICB7LyogLS0tIFJFUVVFU1RTIFRBQiAtLS0gKi99XHJcbiAgICAgICAgICB7YWN0aXZlVGFiID09PSAncmVxdWVzdHMnICYmIChcclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIGxnOmdyaWQtY29scy0xMiBnYXAtOCBpdGVtcy1zdGFydCBhbmltYXRlLWluIHNsaWRlLWluLWZyb20tYm90dG9tLTMgZHVyYXRpb24tNTAwXCI+XHJcbiAgICAgICAgICAgICAgey8qIEZvcm0gKi99XHJcbiAgICAgICAgICAgICAge2NhbkNyZWF0ZUF0dGVuZGFuY2UgJiYgKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJsZzpjb2wtc3Bhbi01XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxTZWN0aW9uSGVhZGluZyB0aXRsZT1cIlJlZ3VsYXJpemF0aW9uXCIgLz5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy13aGl0ZSBwLTYgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLVsjRTJFOEYwXSBzaGFkb3ctc21cIj5cclxuICAgICAgICAgICAgICAgICAgICA8Zm9ybSBvblN1Ym1pdD17aGFuZGxlUmVxdWVzdFN1Ym1pdH0gY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTEuNVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtWyM2NDc0OEJdXCI+VGFyZ2V0IERhdGUgKjwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiZGF0ZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1aXJlZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4PXtkYXlqcygpLmZvcm1hdCgnWVlZWS1NTS1ERCcpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGgtWzQwcHhdIGJnLXdoaXRlIGJvcmRlciBib3JkZXItWyNFMkU4RjBdIHJvdW5kZWQtbGcgcHgtNCB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtWyMzMzQxNTVdIG91dGxpbmUtbm9uZSBmb2N1czpyaW5nLTQgZm9jdXM6cmluZy1ibHVlLTUwMC81IGZvY3VzOmJvcmRlci1bIzI1NjNFQl0gdHJhbnNpdGlvbi1hbGxcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3JlcXVlc3RGb3JtLnN0YXJ0RGF0ZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHNldFJlcXVlc3RGb3JtKHsgLi4ucmVxdWVzdEZvcm0sIHN0YXJ0RGF0ZTogZS50YXJnZXQudmFsdWUgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0xLjVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LVsjNjQ3NDhCXVwiPkNhdGVnb3J5PC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImgtWzQwcHhdIGZsZXggaXRlbXMtY2VudGVyIHB4LTQgYmctd2hpdGUgYm9yZGVyIGJvcmRlci1bI0UyRThGMF0gcm91bmRlZC1sZyB0ZXh0LXhzIGZvbnQtc2VtaWJvbGQgdGV4dC1bIzY0NzQ4Ql0gdHJhY2tpbmctd2lkZSB1cHBlcmNhc2Ugb3BhY2l0eS02MFwiPkF0dGVuZGFuY2UgTG9nPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0yIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0xLjVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LVsjNjQ3NDhCXVwiPlB1bmNoIEluPC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJ0aW1lXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBoLVs0MHB4XSBiZy13aGl0ZSBib3JkZXIgYm9yZGVyLVsjRTJFOEYwXSByb3VuZGVkLWxnIHB4LTQgdGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LVsjMzM0MTU1XSBvdXRsaW5lLW5vbmUgZm9jdXM6cmluZy00IGZvY3VzOnJpbmctYmx1ZS01MDAvNSBmb2N1czpib3JkZXItWyMyNTYzRUJdIHRyYW5zaXRpb24tYWxsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtyZXF1ZXN0Rm9ybS5jaGVja0lufVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gc2V0UmVxdWVzdEZvcm0oeyAuLi5yZXF1ZXN0Rm9ybSwgY2hlY2tJbjogZS50YXJnZXQudmFsdWUgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0xLjVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LVsjNjQ3NDhCXVwiPlB1bmNoIE91dDwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwidGltZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgaC1bNDBweF0gYmctd2hpdGUgYm9yZGVyIGJvcmRlci1bI0UyRThGMF0gcm91bmRlZC1sZyBweC00IHRleHQteHMgZm9udC1tZWRpdW0gdGV4dC1bIzMzNDE1NV0gb3V0bGluZS1ub25lIGZvY3VzOnJpbmctNCBmb2N1czpyaW5nLWJsdWUtNTAwLzUgZm9jdXM6Ym9yZGVyLVsjMjU2M0VCXSB0cmFuc2l0aW9uLWFsbFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17cmVxdWVzdEZvcm0uY2hlY2tPdXR9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiBzZXRSZXF1ZXN0Rm9ybSh7IC4uLnJlcXVlc3RGb3JtLCBjaGVja091dDogZS50YXJnZXQudmFsdWUgfSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMS41XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtWyM2NDc0OEJdXCI+SnVzdGlmaWNhdGlvbiBSZWFzb24gKjwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZXh0YXJlYVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJXaHkgaXMgdGhpcyBjb3JyZWN0aW9uIG5lZWRlZD8uLi5cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBiZy1zbGF0ZS01MCBib3JkZXIgYm9yZGVyLVsjRTJFOEYwXSByb3VuZGVkLWxnIHAtNCB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtWyMzMzQxNTVdIG91dGxpbmUtbm9uZSBmb2N1czpyaW5nLTQgZm9jdXM6cmluZy1ibHVlLTUwMC81IGZvY3VzOmJvcmRlci1bIzI1NjNFQl0gdHJhbnNpdGlvbi1hbGwgbWluLWgtWzEyMHB4XSByZXNpemUtbm9uZVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3JlcXVlc3RGb3JtLnJlYXNvbn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiBzZXRSZXF1ZXN0Rm9ybSh7IC4uLnJlcXVlc3RGb3JtLCByZWFzb246IGUudGFyZ2V0LnZhbHVlIH0pfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwdC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwic3VibWl0XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17c3VibWl0dGluZ1JlcXVlc3R9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGgtWzQ0cHhdIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yIHJvdW5kZWQtbGcgYmctWyMyNTYzRUJdIHRleHQtd2hpdGUgdGV4dC14cyBmb250LXNlbWlib2xkIHRyYW5zaXRpb24tYWxsIGhvdmVyOmJnLWJsdWUtNzAwIGFjdGl2ZTpzY2FsZS1bMC45OF0gZGlzYWJsZWQ6b3BhY2l0eS00MCBzaGFkb3ctc20gc2hhZG93LWJsdWUtNTAwLzEwXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtzdWJtaXR0aW5nUmVxdWVzdCA/IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy00IGgtNCBib3JkZXItMiBib3JkZXItd2hpdGUvMjAgYm9yZGVyLXQtd2hpdGUgcm91bmRlZC1mdWxsIGFuaW1hdGUtc3BpblwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8U2VuZCBzaXplPXsxNn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+U3VibWl0IEFkanVzdG1lbnQ8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Lz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZm9ybT5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgICB7LyogSGlzdG9yeSAqL31cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT17Y2xzeChcImxnOmNvbC1zcGFuLTdcIiwgIWNhbkNyZWF0ZUF0dGVuZGFuY2UgJiYgXCJsZzpjb2wtc3Bhbi0xMlwiKX0+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBtYi0yXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxTZWN0aW9uSGVhZGluZyB0aXRsZT1cIkFkanVzdG1lbnQgTG9nXCIgLz5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LVsjNjQ3NDhCXSBiZy1zbGF0ZS0xMDAgcHgtMyBweS0xIHJvdW5kZWQtZnVsbFwiPntyZXF1ZXN0cy5sZW5ndGh9IFRvdGFsPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTNcIj5cclxuICAgICAgICAgICAgICAgICAgeyFjYW5TZWVSZXF1ZXN0SGlzdG9yeSA/IChcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdoaXRlIHAtMTIgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLWRhc2hlZCBib3JkZXItWyNFMkU4RjBdIGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG9wYWNpdHktNjBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxIaXN0b3J5IHNpemU9ezMyfSBjbGFzc05hbWU9XCJtYi0yIHRleHQtc2xhdGUtMzAwXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1tZWRpdW0gdXBwZXJjYXNlXCI+SGlzdG9yeSBoaWRkZW4gYnkgYWNjZXNzIGNvbnRyb2w8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICkgOiByZXF1ZXN0cy5sZW5ndGggPiAwID8gKFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RzLm1hcCgocmVxLCBpKSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17aX0gY2xhc3NOYW1lPVwiYmctd2hpdGUgcC00IHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1bI0UyRThGMF0gc2hhZG93LXNtIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDAgaG92ZXI6c2hhZG93LW1kXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMTIgaC0xMiBiZy1zbGF0ZS01MCBib3JkZXIgYm9yZGVyLVsjRTJFOEYwXSByb3VuZGVkLWxnIGZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtWyMzMzQxNTVdXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVs5cHhdIHVwcGVyY2FzZSBmb250LXNlbWlib2xkIHRleHQtWyM2NDc0OEJdIG9wYWNpdHktNjAgbGVhZGluZy1ub25lIG1iLTFcIj57ZGF5anMocmVxLnN0YXJ0RGF0ZSkuZm9ybWF0KCdNTU0nKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxOHB4XSBmb250LXNlbWlib2xkIGxlYWRpbmctbm9uZVwiPntkYXlqcyhyZXEuc3RhcnREYXRlKS5mb3JtYXQoJ0REJyl9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aDQgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LWJvbGQgdGV4dC1bIzMzNDE1NV0gbWItMC41XCI+e2Zvcm1hdERhdGVERE1NWVlZWShyZXEuc3RhcnREYXRlKX08L2g0PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LVsjNjQ3NDhCXSBmb250LW1lZGl1bSBsaW5lLWNsYW1wLTEgbWF4LXctWzI0MHB4XVwiPlwie3JlcS5yZWFzb259XCI8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNocmluay0wXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2dldFN0YXR1c0JhZGdlKHJlcS5zdGF0dXMpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICkpXHJcbiAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy13aGl0ZSBwLTEyIHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1kYXNoZWQgYm9yZGVyLVsjRTJFOEYwXSBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBvcGFjaXR5LTQwXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8SGlzdG9yeSBzaXplPXszMn0gY2xhc3NOYW1lPVwibWItMiB0ZXh0LXNsYXRlLTMwMFwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtbWVkaXVtIHVwcGVyY2FzZVwiPk5vIGhpc3Rvcnk8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICApfVxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgXHJcbiAgICAgIHsvKiBFYXJseSBSZXR1cm4gTW9kYWwgKi99XHJcbiAgICAgIHtlYXJseVJldHVybk1vZGFsLmlzT3BlbiAmJiAoXHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmaXhlZCBpbnNldC0wIHotNTAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgYmctc2xhdGUtOTAwLzUwIGJhY2tkcm9wLWJsdXItc20gcC00IGFuaW1hdGUtaW4gZmFkZS1pbiBkdXJhdGlvbi0yMDBcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUgcm91bmRlZC0yeGwgdy1mdWxsIG1heC13LW1kIHNoYWRvdy0yeGwgb3ZlcmZsb3ctaGlkZGVuIGFuaW1hdGUtaW4gem9vbS1pbi05NSBkdXJhdGlvbi0yMDBcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJweC02IHB5LTQgYm9yZGVyLWIgYm9yZGVyLXNsYXRlLTEwMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cclxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LWJvbGQgdGV4dC1zbGF0ZS04MDAgdHJhY2tpbmctdGlnaHRcIj5FYXJseSBSZXR1cm4gLyBDYW5jZWwgTGVhdmU8L2gzPlxyXG4gICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4gc2V0RWFybHlSZXR1cm5Nb2RhbCh7IGlzT3BlbjogZmFsc2UsIGxlYXZlSWQ6IG51bGwsIGxlYXZlRGF0YTogbnVsbCwgbmV3RW5kRGF0ZTogJycgfSl9IGNsYXNzTmFtZT1cInAtMiB0ZXh0LXNsYXRlLTQwMCBob3Zlcjp0ZXh0LXNsYXRlLTYwMCBob3ZlcjpiZy1zbGF0ZS0xMDAgcm91bmRlZC14bCB0cmFuc2l0aW9uLWFsbFwiPlxyXG4gICAgICAgICAgICAgICAgPFhDaXJjbGUgc2l6ZT17MjB9IC8+XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtNiBzcGFjZS15LTVcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLWFtYmVyLTUwIHAtNCByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItYW1iZXItMTAwIGZsZXggaXRlbXMtc3RhcnQgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICAgIDxJbmZvIHNpemU9ezE4fSBjbGFzc05hbWU9XCJ0ZXh0LWFtYmVyLTUwMCBtdC0wLjUgc2hyaW5rLTBcIiAvPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LW1lZGl1bSB0ZXh0LWFtYmVyLTcwMCBsZWFkaW5nLXJlbGF4ZWRcIj5cclxuICAgICAgICAgICAgICAgICAgSWYgeW91IGhhdmUgcmV0dXJuZWQgdG8gd29yayBlYXJsaWVyIHRoYW4gZXhwZWN0ZWQsIHNlbGVjdCB5b3VyIG5ldyBFbmQgRGF0ZSBiZWxvdy4gWW91ciB1bnVzZWQgbGVhdmUgYmFsYW5jZSB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmVmdW5kZWQsIGFuZCB5b3VyIGF0dGVuZGFuY2UgcmVjb3JkcyB3aWxsIGJlIGNsZWFyZWQuXHJcbiAgICAgICAgICAgICAgICAgIDxici8+PGJyLz5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ib2xkXCI+Tm90ZTogVG8gZnVsbHkgY2FuY2VsIHRoaXMgbGVhdmUgYW5kIHJlZnVuZCBhbGwgZGF5cywgY2xpY2sgdGhlICdGdWxsIENhbmNlbCcgYnV0dG9uIGJlbG93Ljwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMS41XCI+XHJcbiAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LWJvbGQgdGV4dC1zbGF0ZS02MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVzdFwiPk5ldyBFbmQgRGF0ZTwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICA8aW5wdXQgXHJcbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJkYXRlXCIgXHJcbiAgICAgICAgICAgICAgICAgIG1pbj17ZGF5anMoZWFybHlSZXR1cm5Nb2RhbC5sZWF2ZURhdGEuc3RhcnREYXRlKS5mb3JtYXQoJ1lZWVktTU0tREQnKX1cclxuICAgICAgICAgICAgICAgICAgbWF4PXtkYXlqcyhlYXJseVJldHVybk1vZGFsLmxlYXZlRGF0YS5lbmREYXRlKS5mb3JtYXQoJ1lZWVktTU0tREQnKX1cclxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGgtWzQycHhdIHB4LTQgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLXNsYXRlLTIwMCBiZy1zbGF0ZS01MCB0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1zbGF0ZS04MDAgZm9jdXM6cmluZy00IGZvY3VzOnJpbmctYmx1ZS01MDAvMTAgZm9jdXM6Ym9yZGVyLWJsdWUtNTAwIG91dGxpbmUtbm9uZSB0cmFuc2l0aW9uLWFsbFwiXHJcbiAgICAgICAgICAgICAgICAgIHZhbHVlPXtlYXJseVJldHVybk1vZGFsLm5ld0VuZERhdGV9XHJcbiAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0RWFybHlSZXR1cm5Nb2RhbCh7IC4uLmVhcmx5UmV0dXJuTW9kYWwsIG5ld0VuZERhdGU6IGUudGFyZ2V0LnZhbHVlIH0pfVxyXG4gICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC00IGJvcmRlci10IGJvcmRlci1zbGF0ZS0xMDAgYmctc2xhdGUtNTAgZmxleCBnYXAtMyBqdXN0aWZ5LWVuZCBpdGVtcy1jZW50ZXJcIj5cclxuICAgICAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgb25DbGljaz17YXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgc2V0SXNFYXJseVJldHVybmluZyh0cnVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgY29uc3QgZnVsbENhbmNlbERhdGUgPSBkYXlqcyhlYXJseVJldHVybk1vZGFsLmxlYXZlRGF0YS5zdGFydERhdGUpLnN1YnRyYWN0KDEsICdkYXknKS5mb3JtYXQoJ1lZWVktTU0tREQnKTtcclxuICAgICAgICAgICAgICAgICAgICAgYXdhaXQgYXBpLnBvc3QoYC9lbXBsb3llZS9sZWF2ZXMvZWFybHktcmV0dXJuLyR7ZWFybHlSZXR1cm5Nb2RhbC5sZWF2ZUlkfWAsIHsgbmV3RW5kRGF0ZTogZnVsbENhbmNlbERhdGUgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgIHNldEVhcmx5UmV0dXJuTW9kYWwoeyBpc09wZW46IGZhbHNlLCBsZWF2ZUlkOiBudWxsLCBsZWF2ZURhdGE6IG51bGwsIG5ld0VuZERhdGU6ICcnIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICBmZXRjaERhc2hib2FyZERhdGEoKTtcclxuICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICAgICAgICAgICBhbGVydChcIkZhaWxlZCB0byBmdWxseSBjYW5jZWwgbGVhdmVcIik7XHJcbiAgICAgICAgICAgICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICAgICAgICAgICBzZXRJc0Vhcmx5UmV0dXJuaW5nKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNFYXJseVJldHVybmluZ31cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTUgcHktMi41IHJvdW5kZWQteGwgdGV4dC14cyBmb250LWJvbGQgdGV4dC1yb3NlLTYwMCBob3ZlcjpiZy1yb3NlLTUwIGJvcmRlciBib3JkZXItdHJhbnNwYXJlbnQgaG92ZXI6Ym9yZGVyLXJvc2UtMTAwIHRyYW5zaXRpb24tYWxsIG1yLWF1dG9cIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIEZ1bGwgQ2FuY2VsXHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiBzZXRFYXJseVJldHVybk1vZGFsKHsgaXNPcGVuOiBmYWxzZSwgbGVhdmVJZDogbnVsbCwgbGVhdmVEYXRhOiBudWxsLCBuZXdFbmREYXRlOiAnJyB9KX0gY2xhc3NOYW1lPVwicHgtNSBweS0yLjUgcm91bmRlZC14bCB0ZXh0LXhzIGZvbnQtYm9sZCB0ZXh0LXNsYXRlLTYwMCBob3ZlcjpiZy1zbGF0ZS0yMDAgdHJhbnNpdGlvbi1hbGxcIj5DYW5jZWw8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8YnV0dG9uIFxyXG4gICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlRWFybHlSZXR1cm5TdWJtaXR9IFxyXG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzRWFybHlSZXR1cm5pbmcgfHwgIWVhcmx5UmV0dXJuTW9kYWwubmV3RW5kRGF0ZX1cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTUgcHktMi41IHJvdW5kZWQteGwgYmctYmx1ZS02MDAgdGV4dC13aGl0ZSB0ZXh0LXhzIGZvbnQtYm9sZCBob3ZlcjpiZy1ibHVlLTcwMCBzaGFkb3ctc20gZGlzYWJsZWQ6b3BhY2l0eS01MCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB0cmFuc2l0aW9uLWFsbCBhY3RpdmU6c2NhbGUtOTVcIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIHtpc0Vhcmx5UmV0dXJuaW5nID8gPGRpdiBjbGFzc05hbWU9XCJ3LTQgaC00IGJvcmRlci0yIGJvcmRlci13aGl0ZS8zMCBib3JkZXItdC13aGl0ZSByb3VuZGVkLWZ1bGwgYW5pbWF0ZS1zcGluXCIgLz4gOiA8Q2hlY2tDaXJjbGUgc2l6ZT17MTR9IC8+fVxyXG4gICAgICAgICAgICAgICAgQ29uZmlybSBSZXR1cm5cclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgKX1cclxuXHJcbiAgICAgIHsvKiDilIDilIDilIAgTGVhdmUgUmVxdWVzdCBEZXRhaWxzIE1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCAqL31cclxuICAgICAge3NlbGVjdGVkTGVhdmUgJiYgY3JlYXRlUG9ydGFsKFxyXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCB6LTUwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJnLWJsYWNrLzQwIGJhY2tkcm9wLWJsdXItc20gcC00IGFuaW1hdGUtaW4gZmFkZS1pbiBkdXJhdGlvbi0yMDBcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUgcm91bmRlZC0zeGwgc2hhZG93LTJ4bCB3LWZ1bGwgbWF4LXctbGcgbWF4LWgtWzkwdmhdIGZsZXggZmxleC1jb2wgb3ZlcmZsb3ctaGlkZGVuIGJvcmRlciBib3JkZXItc2xhdGUtMTAwIGFuaW1hdGUtaW4gem9vbS1pbi05NSBkdXJhdGlvbi0yMDBcIj5cclxuICAgICAgICAgICAgey8qIEhlYWRlciAqL31cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gcHgtNiBweS00IGJvcmRlci1iIGJvcmRlci1zbGF0ZS0xMDAgYmctc2xhdGUtNTAgc2hyaW5rLTAgZm9udC1pbnRlclwiPlxyXG4gICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICA8aDIgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LWJsYWNrIHRleHQtc2xhdGUtOTAwIHVwcGVyY2FzZSB0cmFja2luZy10aWdodCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMS41XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxGaWxlVGV4dCBzaXplPXsxNn0gY2xhc3NOYW1lPVwidGV4dC1pbmRpZ28tNjUwXCIgLz5cclxuICAgICAgICAgICAgICAgICAgTGVhdmUgUmVxdWVzdCBEZXRhaWxzXHJcbiAgICAgICAgICAgICAgICA8L2gyPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtc2xhdGUtNDAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlc3QgbXQtMC41XCI+XHJcbiAgICAgICAgICAgICAgICAgIFJFUS17c2VsZWN0ZWRMZWF2ZS5faWQ/LnNsaWNlKC02KS50b1VwcGVyQ2FzZSgpfVxyXG4gICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDxidXR0b24gXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTZWxlY3RlZExlYXZlKG51bGwpfSBcclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctOSBoLTkgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC14bCBob3ZlcjpiZy1yb3NlLTUwIHRleHQtc2xhdGUtNDAwIGhvdmVyOnRleHQtcm9zZS01MDAgdHJhbnNpdGlvbi1hbGwgYWN0aXZlOnNjYWxlLTk1IGFuaW1hdGUtaW4gZmFkZS1pblwiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPFhDaXJjbGUgc2l6ZT17MTh9IC8+XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgey8qIENvbnRlbnQgKi99XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIG92ZXJmbG93LXktYXV0byBwLTYgc3BhY2UteS01IGZvbnQtaW50ZXIgdGV4dC14c1wiPlxyXG4gICAgICAgICAgICAgIHsvKiBTdGF0dXMgYW5kIExlYXZlIFR5cGUgR3JpZCAqL31cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTIgZ2FwLTQgYmctc2xhdGUtNTAvNTAgcC00IHJvdW5kZWQtMnhsIGJvcmRlciBib3JkZXItc2xhdGUtMTAwXCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdGV4dC1zbGF0ZS00MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrIG1iLTFcIj5MZWF2ZSBDYXRlZ29yeTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwicHgtMiBweS0wLjUgYmctaW5kaWdvLTUwIGJvcmRlciBib3JkZXItaW5kaWdvLTEwMCB0ZXh0LWluZGlnby03MDAgdGV4dC14cyBmb250LWJsYWNrIHJvdW5kZWRcIj57c2VsZWN0ZWRMZWF2ZS5sZWF2ZVR5cGV9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdGV4dC1zbGF0ZS00MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrIG1iLTFcIj5DdXJyZW50IFN0YXR1czwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAge2dldFN0YXR1c0JhZGdlKHNlbGVjdGVkTGVhdmUuc3RhdHVzLCBzZWxlY3RlZExlYXZlLm1ldGEpfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIHsvKiBEYXRlcyAmIER1cmF0aW9uICovfVxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdGV4dC1zbGF0ZS00MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+RHVyYXRpb24gRGV0YWlsczwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctd2hpdGUgYm9yZGVyIGJvcmRlci1zbGF0ZS0xNTAgcm91bmRlZC14bCBwLTQgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMTAgaC0xMCByb3VuZGVkLWxnIGJnLWluZGlnby01MC81MCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB0ZXh0LWluZGlnby02MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxDYWxlbmRhckljb24gc2l6ZT17MTh9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LWJvbGQgdGV4dC1zbGF0ZS04MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdERhdGVERE1NWVlZWShzZWxlY3RlZExlYXZlLnN0YXJ0RGF0ZSl9IHtzZWxlY3RlZExlYXZlLmVuZERhdGUgJiYgc2VsZWN0ZWRMZWF2ZS5lbmREYXRlICE9PSBzZWxlY3RlZExlYXZlLnN0YXJ0RGF0ZSA/IGDihpIgJHtmb3JtYXREYXRlRERNTVlZWVkoc2VsZWN0ZWRMZWF2ZS5lbmREYXRlKX1gIDogJyd9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gdGV4dC1zbGF0ZS00MDAgZm9udC1tZWRpdW0gbXQtMC41XCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEFwcGxpZWQgb24ge3NlbGVjdGVkTGVhdmUuY3JlYXRlZEF0ID8gZGF5anMoc2VsZWN0ZWRMZWF2ZS5jcmVhdGVkQXQpLmZvcm1hdCgnREQtTU0tWVlZWSBISDptbScpIDogJ04vQSd9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1yaWdodFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1leHRyYWJvbGQgdGV4dC1bIzI1NjNFQl1cIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHtzZWxlY3RlZExlYXZlLmRheXNDb3VudH0ge3NlbGVjdGVkTGVhdmUuZGF5c0NvdW50ID09PSAxID8gJ0RheScgOiAnRGF5cyd9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIHtzZWxlY3RlZExlYXZlLmlzSGFsZkRheSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJibG9jayB0ZXh0LVs5cHhdIGZvbnQtYm9sZCB0ZXh0LWFtYmVyLTYwMCBiZy1hbWJlci01MCBib3JkZXIgYm9yZGVyLWFtYmVyLTEwMCBweC0xIHB5LTAuNSByb3VuZGVkIG10LTEgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGN1c3RvbSA9IHNlbGVjdGVkTGVhdmUubWV0YT8uY3VzdG9tSGFsZkRheXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1c3RvbSAmJiBzZWxlY3RlZExlYXZlLnN0YXJ0RGF0ZSAhPT0gc2VsZWN0ZWRMZWF2ZS5lbmREYXRlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VzdG9tLmZpcnN0RGF5SGFsZiAmJiBjdXN0b20ubGFzdERheUhhbGYpIHJldHVybiAnSGFsZiAoQm90aCBEYXlzKSc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VzdG9tLmZpcnN0RGF5SGFsZikgcmV0dXJuIGBIYWxmIChGaXJzdDogJHtjdXN0b20uZmlyc3REYXlTZXNzaW9uLnNwbGl0KCcgJylbMF19KWA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VzdG9tLmxhc3REYXlIYWxmKSByZXR1cm4gYEhhbGYgKExhc3Q6ICR7Y3VzdG9tLmxhc3REYXlTZXNzaW9uLnNwbGl0KCcgJylbMF19KWA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxlY3RlZExlYXZlLmhhbGZEYXlTZXNzaW9uIHx8ICdIYWxmIERheSc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKCl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgey8qIFJlYXNvbiAvIEp1c3RpZmljYXRpb24gKi99XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTEuNVwiPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtc2xhdGUtNDAwIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciBibG9ja1wiPkp1c3RpZmljYXRpb24gLyBSZWFzb248L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXNsYXRlLTUwIGJvcmRlciBib3JkZXItc2xhdGUtMTAwIHJvdW5kZWQteGwgcC00IHRleHQteHMgZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03NTAgbGVhZGluZy1yZWxheGVkIG1pbi1oLVs2MHB4XSB3aGl0ZXNwYWNlLXByZS1saW5lXCI+XHJcbiAgICAgICAgICAgICAgICAgIHtzZWxlY3RlZExlYXZlLnJlYXNvbiB8fCA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTQwMCBpdGFsaWNcIj5ObyByZWFzb24gcHJvdmlkZWQ8L3NwYW4+fVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgIHsvKiBMZWF2ZSBCYWxhbmNlcyBHcmlkICovfVxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdGV4dC1zbGF0ZS00MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+TGVhdmUgQmFsYW5jZTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgICAgICB7YmFsYW5jZXMuZmlsdGVyKGIgPT4gU3RyaW5nKGIubGVhdmVUeXBlKS50b1VwcGVyQ2FzZSgpID09PSBTdHJpbmcoc2VsZWN0ZWRMZWF2ZS5sZWF2ZVR5cGUpLnRvVXBwZXJDYXNlKCkpLm1hcChiID0+IChcclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17Yi5sZWF2ZVR5cGV9IGNsYXNzTmFtZT1cInAtMi41IHJvdW5kZWQteGwgYm9yZGVyIHRleHQtY2VudGVyIHRyYW5zaXRpb24tYWxsIGJnLWluZGlnby01MC8yMCBib3JkZXItaW5kaWdvLTIwMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LVs5cHhdIGZvbnQtYm9sZCB0ZXh0LXNsYXRlLTQwMCB1cHBlcmNhc2VcIj57Yi5sZWF2ZVR5cGV9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1leHRyYWJvbGQgdGV4dC1zbGF0ZS04MDAgbXQtMC41XCI+e2IuYXZhaWxhYmxlfSA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVs5cHhdIGZvbnQtYm9sZCB0ZXh0LXNsYXRlLTQwMCB1cHBlcmNhc2VcIj5BdmFpbDwvc3Bhbj48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgey8qIE1lZGljYWwgQ2VydGlmaWNhdGUgKi99XHJcbiAgICAgICAgICAgICAge3NlbGVjdGVkTGVhdmUubWVkaWNhbENlcnRVcmwgJiYgKFxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTEuNVwiPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdGV4dC1zbGF0ZS00MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+TWVkaWNhbCBDZXJ0aWZpY2F0ZTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPGEgXHJcbiAgICAgICAgICAgICAgICAgICAgaHJlZj17c2VsZWN0ZWRMZWF2ZS5tZWRpY2FsQ2VydFVybC5zdGFydHNXaXRoKCdodHRwJykgPyBzZWxlY3RlZExlYXZlLm1lZGljYWxDZXJ0VXJsIDogYGh0dHA6Ly9sb2NhbGhvc3Q6NTAwOSR7c2VsZWN0ZWRMZWF2ZS5tZWRpY2FsQ2VydFVybH1gfSBcclxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQ9XCJfYmxhbmtcIiBcclxuICAgICAgICAgICAgICAgICAgICByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCJcclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTIgcHktMiBib3JkZXIgYm9yZGVyLWVtZXJhbGQtMjAwIGhvdmVyOmJvcmRlci1lbWVyYWxkLTQwMCBiZy1lbWVyYWxkLTUwLzIwIHRleHQtZW1lcmFsZC03MDAgdGV4dC14cyBmb250LWJvbGQgcm91bmRlZC14bCB0cmFuc2l0aW9uLWFsbCBzaGFkb3ctc21cIlxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgPEZpbGVUZXh0IHNpemU9ezE0fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuPlZpZXcgTWVkaWNhbCBDZXJ0aWZpY2F0ZTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgPC9hPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgey8qIEhpc3RvcnkgbG9nL1dvcmtmbG93IERldGFpbHMgKi99XHJcbiAgICAgICAgICAgICAgeyhzZWxlY3RlZExlYXZlLmFwcHJvdmVkQXQgfHwgc2VsZWN0ZWRMZWF2ZS5yZWplY3RlZEF0IHx8IHNlbGVjdGVkTGVhdmUuY2FuY2VsbGVkQXQpICYmIChcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYm9yZGVyLXQgYm9yZGVyLXNsYXRlLTEwMCBwdC00IHNwYWNlLXktMiB0ZXh0LVsxMXB4XSB0ZXh0LXNsYXRlLTUwMFwiPlxyXG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSBmb250LWJvbGQgdGV4dC1zbGF0ZS00MDAgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIGJsb2NrXCI+QWN0aW9uIFRyYWlsPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMS41IGJnLXNsYXRlLTUwLzMwIGJvcmRlciBib3JkZXItc2xhdGUtMTAwIHAtMyByb3VuZGVkLXhsXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYm9sZCB0ZXh0LXNsYXRlLTcwMFwiPkFjdGlvbjogPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPXtjbHN4KFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImZvbnQtYm9sZCB1cHBlcmNhc2VcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0ZWRMZWF2ZS5zdGF0dXMgPT09ICdBcHByb3ZlZCcgJiYgJ3RleHQtWyMxNkEzNEFdJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgKHNlbGVjdGVkTGVhdmUuc3RhdHVzID09PSAnUmVqZWN0ZWQnIHx8IHNlbGVjdGVkTGVhdmUuc3RhdHVzID09PSAnQ2FuY2VsbGVkJykgJiYgJ3RleHQtWyNEQzI2MjZdJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgKX0+e3NlbGVjdGVkTGVhdmUuc3RhdHVzfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICB7c2VsZWN0ZWRMZWF2ZS5hY3Rpb25CeSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1zbGF0ZS03MDBcIj5Qcm9jZXNzZWQgQnk6IDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1tZWRpdW1cIj57c2VsZWN0ZWRMZWF2ZS5hY3Rpb25CeS5maXJzdE5hbWV9IHtzZWxlY3RlZExlYXZlLmFjdGlvbkJ5Lmxhc3ROYW1lfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYm9sZCB0ZXh0LXNsYXRlLTcwMFwiPlByb2Nlc3NlZCBPbjogPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1tZWRpdW1cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2RheWpzKHNlbGVjdGVkTGVhdmUuYXBwcm92ZWRBdCB8fCBzZWxlY3RlZExlYXZlLnJlamVjdGVkQXQgfHwgc2VsZWN0ZWRMZWF2ZS5jYW5jZWxsZWRBdCkuZm9ybWF0KCdERC1NTS1ZWVlZIEhIOm1tJyl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAge3NlbGVjdGVkTGVhdmUucmVqZWN0aW9uUmVhc29uICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1yb3NlLTYwMCBiZy1yb3NlLTUwLzUwIHAtMiByb3VuZGVkIGJvcmRlciBib3JkZXItcm9zZS0xMDAgbXQtMSBmb250LW1lZGl1bVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1yb3NlLTcwMFwiPlJlamVjdGlvbiBSZWFzb246PC9zcGFuPiB7c2VsZWN0ZWRMZWF2ZS5yZWplY3Rpb25SZWFzb259XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgIHtzZWxlY3RlZExlYXZlLmFkbWluUmVtYXJrICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS02MDAgYmctc2xhdGUtNTAgcC0yIHJvdW5kZWQgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgbXQtMSBmb250LW1lZGl1bVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1zbGF0ZS03MDBcIj5BZG1pbiBSZW1hcmtzOjwvc3Bhbj4ge3NlbGVjdGVkTGVhdmUuYWRtaW5SZW1hcmt9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgICAgIHsvKiBFYXJseSBSZXR1cm4gcmVxdWVzdCBpbmZvICovfVxyXG4gICAgICAgICAgICAgIHtzZWxlY3RlZExlYXZlLm1ldGE/LmVhcmx5UmV0dXJuUmVxdWVzdCAmJiAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci10IGJvcmRlci1zbGF0ZS0xMDAgcHQtNCBzcGFjZS15LTIgdGV4dC1bMTFweF1cIj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gZm9udC1ib2xkIHRleHQtcHVycGxlLTY1NSB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXIgYmxvY2tcIj5FYXJseSBSZXR1cm4gUmVxdWVzdCBEZXRhaWxzPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXB1cnBsZS01MC8zMCBib3JkZXIgYm9yZGVyLXB1cnBsZS0xMDAgcC0zIHJvdW5kZWQteGwgc3BhY2UteS0xLjVcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ib2xkIHRleHQtcHVycGxlLTcwMFwiPlByb3Bvc2VkIFJldHVybiBEYXRlOiA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1zbGF0ZS04MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2RheWpzKHNlbGVjdGVkTGVhdmUubWV0YS5lYXJseVJldHVyblJlcXVlc3QuYWN0dWFsUmV0dXJuRGF0ZSkuZm9ybWF0KCdERC1NTS1ZWVlZJyl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtYm9sZCB0ZXh0LXB1cnBsZS03MDBcIj5SZXF1ZXN0IFN0YXR1czogPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ib2xkIHVwcGVyY2FzZSB0ZXh0LXB1cnBsZS02MDBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAge3NlbGVjdGVkTGVhdmUubWV0YS5lYXJseVJldHVyblJlcXVlc3Quc3RhdHVzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1wdXJwbGUtNzAwXCI+UmVhc29uOiA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LW1lZGl1bSB0ZXh0LXNsYXRlLTc1MFwiPntzZWxlY3RlZExlYXZlLm1ldGEuZWFybHlSZXR1cm5SZXF1ZXN0LnJlYXNvbn08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAge3NlbGVjdGVkTGVhdmUubWV0YS5lYXJseVJldHVyblJlcXVlc3QuY29tbWVudHMgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1ib2xkIHRleHQtcHVycGxlLTcwMFwiPkNvbW1lbnRzOiA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZvbnQtbWVkaXVtIHRleHQtc2xhdGUtNjUwXCI+e3NlbGVjdGVkTGVhdmUubWV0YS5lYXJseVJldHVyblJlcXVlc3QuY29tbWVudHN9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PixcclxuICAgICAgICBkb2N1bWVudC5ib2R5XHJcbiAgICAgICl9XHJcblxyXG4gICAgPC9kaXY+XHJcbiAgKTtcclxufVxyXG4iXSwiZmlsZSI6IkM6L1VzZXJzL3VzZXIvRG9jdW1lbnRzL0dpdEh1Yi9HaXRha3NobWlfSFJNU19XZWJfQXBwL2NsaWVudC9zcmMvcGFnZXMvRW1wbG95ZWUvQXR0ZW5kYW5jZU1vZHVsZS5qc3gifQ==
