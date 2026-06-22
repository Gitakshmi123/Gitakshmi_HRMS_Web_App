import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import api, { API_ROOT } from "../../utils/api";
import { DatePicker, Select } from "antd";
import { showToast, showConfirmToast } from "../../utils/uiNotifications";
import dayjs from "dayjs";
import clsx from "clsx";
import ApplyLeaveForm from "../../components/ApplyLeaveForm";
import EmployeeExcelUploadModal from "../../components/HR/EmployeeExcelUploadModal";
import "./Employees.css";
import {
  Calendar as CalendarIcon,
  User,
  Plus,
  FileText,
  Edit2,
  Trash2,
  Eye,
  IndianRupee,
  MoreHorizontal,
  Upload,
  Users,
  Briefcase,
  Phone,
  Mail,
  Search,
  LayoutGrid,
  List,
  FileSpreadsheet,
  UserCheck,
  UserX,
  Building2,
  UserPlus,
  MoreVertical,
  DollarSign,
  X,
  Shield,
  Lock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import usePagePermissions from "../../hooks/usePagePermissions";

const BACKEND_URL = API_ROOT || "";

export default function Employees() {
  const navigate = useNavigate();
  const location = useLocation();
  const [employees, setEmployees] = useState([]);
  const [externalRecords, setExternalRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openUploadPopup, setOpenUploadPopup] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [employeeViewMode, setEmployeeViewMode] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [quickViewEmployee, setQuickViewEmployee] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Joining Letter State
  const [showJoiningModal, setShowJoiningModal] = useState(false);
  const [selectedEmpForJoining, setSelectedEmpForJoining] = useState(null);
  const [joiningTemplateId, setJoiningTemplateId] = useState("");
  const [joiningTemplates, setJoiningTemplates] = useState([]);
  const [generatingJoining, setGeneratingJoining] = useState(false);
  const [joiningRefNo, setJoiningRefNo] = useState("");
  const [joiningIssueDate, setJoiningIssueDate] = useState(
    dayjs().format("YYYY-MM-DD"),
  );
  const { canView, canCreate, canEdit, canDelete, loading: permLoading } = usePagePermissions('people.employees');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch main employees and drafts separately to handle partial permissions (e.g. employee can't see drafts)
      let activeEmployees = [];
      let draftEmployees = [];

      try {
        const res = await api.get("/hr/employees?limit=1000");
        activeEmployees = res.data?.data || res.data || [];
      } catch (err) {
        console.error("[Employees] Failed to fetch active employees:", err.message);
        showToast("error", "Error", "Failed to load employee list");
      }

      try {
        // Only attempt to fetch drafts if the role might have access (HR or custom perms)
        const res = await api.get("/hr/employees?limit=1000&status=Draft");
        draftEmployees = res.data?.data || res.data || [];
      } catch (err) {
        // Silent fail for drafts - common for employees without HR privileges
        console.log("[Employees] Drafts access limited or failed.");
      }

      setEmployees([...draftEmployees, ...activeEmployees]);
      try {
        const externalRes = await api.get("/applications/external-records/list?limit=1000");
        setExternalRecords(externalRes.data?.data || []);
      } catch (err) {
        console.log("[Employees] External records access limited or failed.");
      }
    } catch (err) {
      console.error("[Employees] Unexpected load failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (target?.closest?.(".card-menu-dropdown") || target?.closest?.(".card-menu-btn")) {
        return;
      }
      setMenuOpenId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openAdd = () => {
    navigate("new");
  };

  const openEdit = (emp) => {
    navigate(`${emp._id}/edit`, {
      state: { employee: emp },
    });
  };

  const handleStatusToggle = (emp) => {
    const isCurrentlyActive = String(emp.status || "").toLowerCase() === "active";
    const newStatus = isCurrentlyActive ? "Inactive" : "Active";
    
    showConfirmToast({
      title: `${newStatus} Employee`,
      description: `Are you sure you want to set ${getDisplayName(emp)} as ${newStatus}?`,
      okText: isCurrentlyActive ? "Deactivate" : "Activate",
      cancelText: "Cancel",
      danger: isCurrentlyActive,
      onConfirm: async () => {
        try {
          await api.put(`/hr/employees/${emp._id}`, { status: newStatus });
          load();
          showToast("success", "Status Updated", `Employee is now ${newStatus}`);
        } catch (err) {
          showToast("error", "Error", "Failed to update status");
        }
      },
    });
  };

  const exportToCSV = () => {
    if (!employees.length)
      return showToast("info", "Empty", "No data to export");
    const headers = [
      "Employee ID",
      "Name",
      "Department",
      "Designation",
      "Joining Date",
      "Status",
    ];
    const csvRows = employees.map((e) =>
      [
        e.employeeId,
        getDisplayName(e),
        e.department,
        e.designation,
        e.joiningDate ? dayjs(e.joiningDate).format("YYYY-MM-DD") : "",
        e.status,
      ].join(","),
    );
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `employees_export_${dayjs().format("YYYY-MM-DD")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    const nonDraftEmployees = employees.filter(
      (e) => String(e.status || "").toLowerCase() !== "draft",
    );
    const total = nonDraftEmployees.length;
    const drafts = employees.filter(
      (e) => String(e.status || "").toLowerCase() === "draft",
    ).length;
    const active = nonDraftEmployees.filter((e) =>
      ["ACTIVE", "Active", "active"].includes(e.status),
    ).length;
    const depts = [
      ...new Set(nonDraftEmployees.map((e) => e.department).filter(Boolean)),
    ].length;
    const newJoiners = nonDraftEmployees.filter(
      (e) =>
        e.joiningDate &&
        dayjs(e.joiningDate).isAfter(dayjs().subtract(30, "days")),
    ).length;
    return { total, active, depts, newJoiners, drafts, external: externalRecords.length };
  }, [employees, externalRecords]);

  const departmentStats = useMemo(() => {
    const deptMap = {};
    employees.forEach((emp) => {
      if (!emp.department) return;
      if (!deptMap[emp.department])
        deptMap[emp.department] = {
          name: emp.department,
          count: 0,
          members: [],
        };
      deptMap[emp.department].count++;
      if (deptMap[emp.department].members.length < 3) {
        deptMap[emp.department].members.push({
          initials: (emp.firstName?.[0] || "") + (emp.lastName?.[0] || ""),
          profilePic: emp.profilePic
        });
      }
    });
    return Object.values(deptMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const status = emp.status?.toLowerCase() || "active";
      const isIntern =
        String(emp.employeeId || "").toUpperCase().startsWith("INTN") ||
        String(emp.jobType || "").toLowerCase().includes("intern") ||
        String(emp.designation || "").toLowerCase().includes("intern") ||
        String(emp.role || "").toLowerCase().includes("intern");

      const matchesStatus =
        (employeeViewMode === "all" && status !== "draft") ||
        (employeeViewMode === "Employee" && !isIntern && status !== "draft") ||
        (employeeViewMode === "Active" && status === "active") ||
        (employeeViewMode === "Inactive" && status === "inactive") ||
        (employeeViewMode === "On Leave" &&
          (status === "notice" || status === "on leave")) ||
        (employeeViewMode === "Intern" && isIntern) ||
        (employeeViewMode === "Draft" && status === "draft");

      const fullSearch =
        `${emp.firstName || ""} ${emp.lastName || ""} ${emp.employeeId || ""} ${emp.department || ""} ${emp.designation || ""}`.toLowerCase();
      const matchesSearch = fullSearch.includes(searchTerm.toLowerCase());
      const matchesDepartment =
        !selectedDepartment ||
        String(emp.department || "").toLowerCase() === selectedDepartment.toLowerCase();

      return matchesStatus && matchesSearch && matchesDepartment;
    });
  }, [employees, employeeViewMode, searchTerm, selectedDepartment]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  const filteredExternalRecords = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return externalRecords.filter((record) => {
      const text = [
        record.applicantId?.name,
        record.applicantId?.applicationId,
        record.applicantId?.email,
        record.jobId?.jobTitle,
        record.status,
      ].filter(Boolean).join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [externalRecords, searchTerm]);

  const paginatedExternalRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExternalRecords.slice(start, start + pageSize);
  }, [filteredExternalRecords, currentPage, pageSize]);

  const activeRecordCount = employeeViewMode === "External Records" ? filteredExternalRecords.length : filteredEmployees.length;
  const totalPages = Math.ceil(activeRecordCount / pageSize);

  const getDisplayName = (emp) => {
    if (!emp) return "";
    return (
      `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
      emp.employeeId ||
      "Unnamed"
    );
  };

  const getInitials = (emp) => {
    const f = emp?.firstName?.[0] || "";
    const l = emp?.lastName?.[0] || "";
    return (f + l).toUpperCase() || "??";
  };

  const openProfile = async (emp) => {
    if (!emp?._id) return;
    const basePath = location.pathname.startsWith("/tenant") ? "/tenant/employees" : "/hr/employees";
    navigate(`${basePath}/${emp._id}/profile`, {
      state: { employee: emp },
    });
  };

  const openPayroll = (emp) => {
    if (!emp?._id) return;
    const basePath = location.pathname.startsWith("/tenant") ? "/tenant" : "/hr";
    navigate(`${basePath}/salary-structure/${emp._id}?type=employee`, {
      state: { employee: emp },
    });
  };

  const handleExternalAction = async (record, action) => {
    const remarks = action === "approve" ? "" : window.prompt(action === "reject" ? "Reason for rejection:" : "Requested changes:");
    if (remarks === null) return;
    try {
      await api.post(`/applications/external-records/${record._id}/${action === "changes" ? "request-changes" : action}`, { remarks });
      showToast("success", "Updated", "External record updated successfully");
      load();
    } catch (err) {
      showToast("error", "Action failed", err.response?.data?.message || "Unable to update external record");
    }
  };

  const openJoiningModal = (emp) => {
    setSelectedEmpForJoining(emp);
    setJoiningTemplateId("");
    setJoiningRefNo("");
    setJoiningIssueDate(dayjs().format("YYYY-MM-DD"));
    setShowJoiningModal(true);
  };

  const handleJoiningGenerate = async () => {
    if (!joiningTemplateId) {
      showToast("error", "Error", "Select a template");
      return;
    }
    setGeneratingJoining(true);
    try {
      const res = await api.post("/letters/generate-joining", {
        employeeId: selectedEmpForJoining._id,
        templateId: joiningTemplateId,
        refNo: joiningRefNo,
        issueDate: joiningIssueDate,
      });
      if (res.data.downloadUrl) {
        window.open(`${BACKEND_URL}${res.data.downloadUrl}`, "_blank");
        setShowJoiningModal(false);
        showToast("success", "Success", "Letter generated");
      }
    } catch (err) {
      showToast("error", "Error", "Generation failed");
    } finally {
      setGeneratingJoining(false);
    }
  };

  useEffect(() => {
    async function fetchJoiningTemplates() {
      try {
        const res = await api.get("/letters/templates?type=joining");
        setJoiningTemplates(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load joining templates", err);
      }
    }
    if (showJoiningModal) fetchJoiningTemplates();
  }, [showJoiningModal]);

  if (permLoading) return null;

  if (!canView) {
    return <Navigate to="/hr/dashboard" replace />;
  }

  return (
    <div className="employees-page-container">
      <div className="p-0">
        <div className="sticky top-[-12px] z-[20] mb-4 bg-white/80 backdrop-blur-md p-4 px-6 shadow-sm border-b border-slate-100 transition-all">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div style={{ display: 'none' }}>
              <div className="inline-flex items-center rounded-full bg-white border border-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Employee Management
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800">
                Employees
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Search, manage, and review employee records from one place.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-4 flex-1">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                  placeholder="Search employees, ID, department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide shrink-0">
                <div className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-slate-50 p-1 shrink-0">
                  <button
                    className={clsx(
                      "flex h-9 w-10 items-center justify-center rounded-xl transition-all",
                      viewMode === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    className={clsx(
                      "flex h-9 w-10 items-center justify-center rounded-xl transition-all",
                      viewMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                    onClick={() => setViewMode("list")}
                  >
                    <List size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canCreate && (
                    <button
                      type="button"
                      className="h-11 px-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white text-[10px] font-semibold uppercase tracking-widest text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                      onClick={() => setOpenUploadPopup(true)}
                    >
                      <Upload size={14} /> <span className="hidden sm:inline">Upload</span>
                    </button>
                  )}
                  {canView && (
                    <button
                      className="h-11 px-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white text-[10px] font-semibold uppercase tracking-widest text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                      onClick={() => exportToCSV()}
                    >
                      <FileSpreadsheet size={14} /> <span className="hidden sm:inline">Export</span>
                    </button>
                  )}
                  {canCreate && (
                    <button
                      className="h-11 px-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 text-[10px] font-semibold uppercase tracking-widest text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95"
                      onClick={openAdd}
                    >
                      <Plus size={16} /> <span className="whitespace-nowrap">Add Employee</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 px-0">
          <div
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-900">Total Workforce</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-slate-200">
                <Users size={20} />
              </div>
            </div>
          </div>

          <div
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-900">Active Now</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.active}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
                <UserCheck size={20} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-900">Departments</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.depts}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Building2 size={20} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-900">New Joiners</p>
                 <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.newJoiners}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <UserPlus size={20} />
              </div>
            </div>
          </div>
        </div>

        {stats.drafts > 0 && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 gap-3">
            <div className="flex items-center gap-3">
               <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <FileText size={16} />
               </div>
               <span className="font-bold">{stats.drafts} draft records found.</span>
            </div>
            <button
              type="button"
              className="rounded-xl bg-white px-5 py-2 text-xs font-bold uppercase tracking-widest text-amber-800 shadow-sm border border-amber-200 transition hover:bg-amber-100"
              onClick={() => {
                setEmployeeViewMode("Draft");
                setCurrentPage(1);
              }}
            >
              Review Drafts
            </button>
          </div>
        )}

        <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
            {selectedDepartment && (
              <button
                type="button"
                className="h-10 shrink-0 rounded-xl border border-sky-200 bg-sky-50 px-4 text-xs font-bold uppercase tracking-widest text-sky-700 shadow-sm"
                onClick={() => {
                  setSelectedDepartment("");
                  setCurrentPage(1);
                }}
              >
                {selectedDepartment} ×
              </button>
            )}
            {["all", "Employee", "Intern", "Active", "On Leave", "Inactive", "Draft", "External Records"].map((f) => (
              <button
                key={f}
                type="button"
                className={clsx(
                  "h-10 shrink-0 rounded-xl px-5 text-xs font-semibold uppercase tracking-widest transition-all",
                  employeeViewMode === f
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
                onClick={() => {
                  setEmployeeViewMode(f);
                  setCurrentPage(1);
                }}
              >
                {f === "all" ? "All" : f === "Draft" ? "Drafts" : f === "Intern" ? "Interns" : f === "Employee" ? "Employees" : f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 shrink-0 self-end lg:self-center">
            <div className="flex items-center gap-3 px-2 py-1.5 transition-all">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className={clsx(
                  "p-1 transition-all",
                  currentPage === 1 ? "text-slate-200" : "text-slate-400 hover:text-slate-900"
                )}
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span className="text-slate-900">{currentPage}</span> of <span className="text-slate-900">{totalPages || 1}</span>
              </div>

              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className={clsx(
                  "p-1 transition-all",
                  (currentPage === totalPages || totalPages === 0) ? "text-slate-200" : "text-slate-400 hover:text-slate-900"
                )}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 transition-all cursor-pointer shadow-sm"
              >
                {[5, 10, 12, 15, 20, 25, 50].map(size => (
                  <option key={size} value={size}>{size} Records</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div id="employeesSection">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-slate-400 font-semibold text-sm animate-pulse">
                Loading records...
              </div>
            </div>
          )}

          {!loading && employeeViewMode === "External Records" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-100">
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Photo</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Candidate Name</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Candidate ID</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Applied Position</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Completion %</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Submitted Date</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Status</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedExternalRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-sm font-bold uppercase tracking-widest text-slate-300">
                        No external records found
                      </td>
                    </tr>
                  ) : paginatedExternalRecords.map((record) => {
                    const applicant = record.applicantId || {};
                    return (
                      <tr key={record._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3">
                          <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 overflow-hidden">
                            {record.rawEmployeePayload?.profilePic ? (
                              <img
                                src={String(record.rawEmployeePayload.profilePic).startsWith("http") ? record.rawEmployeePayload.profilePic : `${BACKEND_URL}${String(record.rawEmployeePayload.profilePic).startsWith("/") ? "" : "/"}${record.rawEmployeePayload.profilePic}`}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              String(applicant.name || "?").charAt(0).toUpperCase()
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">{applicant.name || "Candidate"}</div>
                          <div className="mt-1 text-[10px] font-medium lowercase tracking-widest text-slate-400">{applicant.email || ""}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-xs font-medium text-slate-500 tabular-nums uppercase tracking-widest">
                          {applicant.applicationId || String(applicant._id || record.candidateId || "").slice(-8)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-xs font-medium text-slate-700 uppercase tracking-widest">
                          {record.jobId?.jobTitle || "--"}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-xs font-black text-slate-700">
                          {record.completionPercentage || 0}%
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-xs font-medium text-slate-500">
                          {record.submittedAt ? dayjs(record.submittedAt).format("DD MMM YYYY") : "--"}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={clsx(
                            "inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest",
                            record.status === "Approved" ? "text-emerald-600" :
                            record.status === "Rejected" ? "text-rose-600" :
                            record.status === "Submitted" ? "text-blue-600" : "text-amber-600"
                          )}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
                              title="View"
                              onClick={() => {
                                const payload = record.rawEmployeePayload || {};
                                setQuickViewEmployee({
                                  ...payload,
                                  firstName: payload.firstName || applicant.name,
                                  email: payload.email || applicant.email,
                                  status: record.status,
                                });
                              }}
                            >
                              <Eye size={14} />
                            </button>
                            {record.status === "Submitted" && canEdit && (
                              <>
                                <button
                                  className="h-8 px-3 inline-flex items-center justify-center rounded-lg bg-emerald-50 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100"
                                  onClick={() => handleExternalAction(record, "approve")}
                                >
                                  Approve
                                </button>
                                <button
                                  className="h-8 px-3 inline-flex items-center justify-center rounded-lg bg-rose-50 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:bg-rose-100"
                                  onClick={() => handleExternalAction(record, "reject")}
                                >
                                  Reject
                                </button>
                                <button
                                  className="h-8 px-3 inline-flex items-center justify-center rounded-lg bg-amber-50 text-[10px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-100"
                                  onClick={() => handleExternalAction(record, "changes")}
                                >
                                  Request Changes
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Grid View */}
          {!loading && employeeViewMode !== "External Records" && viewMode === "grid" && (
            <div className="employee-grid">
            {paginatedEmployees.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-300">
                <Users size={48} className="mb-4" />
                <p className="font-bold text-sm uppercase tracking-widest">
                  No employees found
                </p>
              </div>
            ) : (
              paginatedEmployees.map((emp) => (
                <div
                  key={emp._id}
                  className="employee-card"
                  onClick={() => openProfile(emp)}
                  style={{ zIndex: menuOpenId === emp._id ? 101 : 1 }}
                >



                  <div className="card-header-flex">
                    <div className="card-avatar-wrap">
                      <div className="card-avatar">
                        {emp.profilePic ? (
                          <img src={String(emp.profilePic).startsWith('http') ? emp.profilePic : `${BACKEND_URL}${String(emp.profilePic).startsWith('/') ? '' : '/'}${emp.profilePic}`} alt="" />
                        ) : (
                          getInitials(emp)
                        )}
                      </div>
                      <div
                        className="status-dot"
                        style={{
                          background:
                            emp.status?.toLowerCase() === "active"
                              ? "#00b894"
                              : emp.status?.toLowerCase() === "draft"
                                ? "#f59e0b"
                              : emp.status?.toLowerCase() === "on leave"
                                ? "#0984e3"
                                : "#ff7675",
                        }}
                      ></div>
                    </div>
                    <div className="card-identity">
                      <p className="emp-id">{emp.employeeId || "--"}</p>
                      <h2>{getDisplayName(emp)}</h2>
                    </div>
                  </div>
                  <div className="card-actions-row">
                    {canView && (
                      <button
                        className="action-btn-flat view"
                        title="View Dossier"
                        onClick={(e) => { e.stopPropagation(); openProfile(emp); }}
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        className="action-btn-flat edit"
                        title={emp.status === "Draft" ? "Continue Draft" : "Edit"}
                        onClick={(e) => { e.stopPropagation(); openEdit(emp); }}
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {canCreate && (
                      <button
                        className="action-btn-flat payroll"
                        title="View Payroll"
                        onClick={(e) => { e.stopPropagation(); openPayroll(emp); }}
                      >
                        <IndianRupee size={16} />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        className={clsx(
                          "action-btn-flat",
                          String(emp.status || "").toLowerCase() === "active" ? "status-active" : "status-inactive"
                        )}
                        title={String(emp.status || "").toLowerCase() === "active" ? "Deactivate" : "Activate"}
                        onClick={(e) => { e.stopPropagation(); handleStatusToggle(emp); }}
                      >
                        {String(emp.status || "").toLowerCase() === "active" ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            </div>
          )}

          {/* List View */}
          {!loading && employeeViewMode !== "External Records" && viewMode === "list" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  <th className="px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Employee</th>
                  <th className="px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">ID</th>
                  <th className="px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Department</th>
                  <th className="px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Status</th>
                  <th className="px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedEmployees.map((emp) => (
                  <tr
                    key={emp._id}
                    onClick={() => openProfile(emp)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 group-hover:bg-white group-hover:shadow-sm transition-all overflow-hidden">
                           {emp.profilePic ? (
                             <img 
                               src={emp.profilePic.startsWith('http') ? emp.profilePic : `${BACKEND_URL}${emp.profilePic.startsWith('/') ? '' : '/'}${emp.profilePic}`} 
                               alt="" 
                               className="h-full w-full object-cover" 
                             />
                           ) : getInitials(emp)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900 leading-none">
                            {getDisplayName(emp)}
                          </div>
                          <div className={clsx(
                            "text-[10px] font-medium text-slate-400 mt-1.5 tracking-widest",
                            (emp.email && !emp.email.includes("@placeholder.local")) ? "lowercase" : "uppercase"
                          )}>
                            {emp.email && !emp.email.includes("@placeholder.local") ? emp.email : (emp.designation || "No Designation")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-xs font-medium text-slate-500 tabular-nums uppercase tracking-widest">
                      {emp.employeeId}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-xs font-medium text-slate-700 uppercase tracking-widest">
                      {emp.department || "--"}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest",
                          emp.status?.toLowerCase() === "active" ? "text-emerald-600" :
                          emp.status?.toLowerCase() === "draft" ? "text-amber-600" : "text-rose-600"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {emp.status || "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-right">
                      <div
                        className="flex items-center justify-end gap-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canView && (
                          <button
                            className="h-8 w-6 inline-flex items-center justify-center bg-transparent text-slate-400 hover:text-blue-600 transition-all"
                            title="View Dossier"
                            onClick={() => openProfile(emp)}
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            className="h-8 w-6 inline-flex items-center justify-center bg-transparent text-slate-400 hover:text-amber-600 transition-all"
                            title={emp.status === "Draft" ? "Continue Draft" : "Edit"}
                            onClick={() => openEdit(emp)}
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {canCreate && (
                          <button
                            className="h-8 w-6 inline-flex items-center justify-center bg-transparent text-slate-400 hover:text-emerald-600 transition-all"
                            title="Payroll"
                            onClick={() => openPayroll(emp)}
                          >
                            <IndianRupee size={14} />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            className={clsx(
                                "h-8 w-6 inline-flex items-center justify-center bg-transparent transition-all",
                                String(emp.status || "").toLowerCase() === "active" 
                                    ? "text-emerald-600 hover:text-emerald-700" 
                                    : "text-rose-600 hover:text-rose-700"
                            )}
                            title={String(emp.status || "").toLowerCase() === "active" ? "Deactivate" : "Activate"}
                            onClick={() => handleStatusToggle(emp)}
                          >
                            {String(emp.status || "").toLowerCase() === "active" ? (
                              <CheckCircle size={14} />
                            ) : (
                              <XCircle size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Departments Overview */}
        <div className="section-header mt-6" id="departmentsSection">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <h2>Departments Overview</h2>
            <span
              role="button"
              tabIndex={0}
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#00b894",
                cursor: "pointer",
              }}
              onClick={() => {
                setSelectedDepartment("");
                setCurrentPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setSelectedDepartment("");
                  setCurrentPage(1);
                }
              }}
            >
              View All
            </span>
          </div>
        </div>
        <div className="dept-grid">
          {departmentStats.length === 0 ? (
            <p style={{ color: "#b2bec3", fontSize: "13px" }}>
              No department data yet.
            </p>
          ) : (
            departmentStats.map((dept) => (
              <div
                key={dept.name}
                className="dept-card"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedDepartment(dept.name);
                  setCurrentPage(1);
                  const section = document.getElementById("employeesSection");
                  section?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedDepartment(dept.name);
                    setCurrentPage(1);
                    const section = document.getElementById("employeesSection");
                    section?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
              >
                <div className="dept-info">
                  <h4>{dept.name}</h4>
                  <p>{dept.count} Members</p>
                </div>
                <div className="avatar-stack">
                  {dept.count > 3 && (
                    <div className="stack-item stack-more">
                      +{dept.count - 3}
                    </div>
                  )}
                  {dept.members.slice(0, 3).map((member, i) => (
                    <div 
                      key={i} 
                      className="stack-item"
                      style={member.profilePic ? { 
                        backgroundImage: `url(${String(member.profilePic).startsWith('http') ? member.profilePic : `${BACKEND_URL}${String(member.profilePic).startsWith('/') ? '' : '/'}${member.profilePic}`})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      } : {}}
                    >
                      {!member.profilePic && member.initials}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

      {/* QUICK VIEW MODAL */}
      {quickViewEmployee && (
        <div
          className="modal-overlay"
          onClick={() => setQuickViewEmployee(null)}
        >
          <div className="compact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-compact">
              <div
                className="modal-close-compact"
                onClick={() => setQuickViewEmployee(null)}
              >
                <X size={16} />
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "14px" }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "800",
                    fontSize: "18px",
                    color: "#fff",
                  }}
                >
                  {getInitials(quickViewEmployee)}
                </div>
                <div>
                  <h2
                    style={{ fontSize: "17px", margin: 0, fontWeight: "800" }}
                  >
                    {getDisplayName(quickViewEmployee)}
                  </h2>
                  <p style={{ fontSize: "12px", margin: 0, opacity: 0.85 }}>
                    {quickViewEmployee.designation || "Staff"} ·{" "}
                    {quickViewEmployee.department || "N/A"}
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-body-compact">
              <div className="info-grid">
                <div className="info-item">
                  <label>Employee ID</label>
                  <p>{quickViewEmployee.employeeId || "--"}</p>
                </div>
                <div className="info-item">
                  <label>Department</label>
                  <p>{quickViewEmployee.department || "--"}</p>
                </div>
                <div className="info-item">
                  <label>Email</label>
                  <p style={{ fontSize: "11px" }}>
                    {quickViewEmployee.email || "N/A"}
                  </p>
                </div>
                <div className="info-item">
                  <label>Contact</label>
                  <p>{quickViewEmployee.contactNo || "N/A"}</p>
                </div>
                <div className="info-item">
                  <label>Join Date</label>
                  <p>
                    {quickViewEmployee.joiningDate
                      ? dayjs(quickViewEmployee.joiningDate).format(
                          "DD MMM YYYY",
                        )
                      : "--"}
                  </p>
                </div>
                <div className="info-item">
                  <label>Status</label>
                  <p
                    style={{
                      color:
                        quickViewEmployee.status?.toLowerCase() === "active"
                          ? "#00b894"
                          : quickViewEmployee.status?.toLowerCase() === "draft"
                            ? "#d97706"
                          : "#ff7675",
                      fontWeight: "700",
                    }}
                  >
                    {quickViewEmployee.status || "Active"}
                  </p>
                </div>
              </div>
              <div
                style={{
                  marginTop: "20px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                <button
                  className="btn-p btn-p-main"
                  onClick={() => {
                    openEdit(quickViewEmployee);
                    setQuickViewEmployee(null);
                  }}
                >
                  <Edit2 size={12} /> Edit
                </button>
                <button
                  className="btn-p btn-p-sec"
                  onClick={() => {
                    openProfile(quickViewEmployee);
                    setQuickViewEmployee(null);
                  }}
                >
                  <Eye size={12} /> Dossier
                </button>
                {canCreate && (
                  <button
                    className="btn-p btn-p-sec"
                    onClick={() => {
                      openPayroll(quickViewEmployee);
                      setQuickViewEmployee(null);
                    }}
                  >
                    <DollarSign size={12} /> Salary
                  </button>
                )}
                <button
                  className="btn-p btn-p-sec"
                  onClick={() => {
                    navigate("/hr/leaves", {
                      state: { employeeId: quickViewEmployee._id },
                    });
                    setQuickViewEmployee(null);
                  }}
                >
                  <CalendarIcon size={12} /> Leave
                </button>
                <button
                  className="btn-p btn-p-sec"
                  onClick={() => {
                    openJoiningModal(quickViewEmployee);
                    setQuickViewEmployee(null);
                  }}
                >
                  <FileText size={12} /> Letter
                </button>
                {canCreate && (
                  <button
                    className="btn-p btn-p-sec"
                    onClick={() => {
                      navigate("/hr/payroll/dashboard");
                      setQuickViewEmployee(null);
                    }}
                  >
                    <IndianRupee size={12} /> Payroll
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JOINING LETTER MODAL */}
      {showJoiningModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowJoiningModal(false)}
        >
          <div className="compact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-compact" style={{ minHeight: "70px" }}>
              <div
                className="modal-close-compact"
                onClick={() => setShowJoiningModal(false)}
              >
                <X size={16} />
              </div>
              <h2 style={{ fontSize: "18px", margin: 0, fontWeight: "800" }}>
                Generate Joining Letter
              </h2>
            </div>
            <div className="modal-body-compact">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div className="info-item">
                  <label>Select Template</label>
                  <select
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      marginTop: "4px",
                      fontSize: "13px",
                    }}
                    value={joiningTemplateId}
                    onChange={(e) => setJoiningTemplateId(e.target.value)}
                  >
                    <option value="">Choose a template...</option>
                    {joiningTemplates.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="info-item">
                  <label>Reference Number</label>
                  <input
                    type="text"
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      marginTop: "4px",
                      fontSize: "13px",
                    }}
                    value={joiningRefNo}
                    onChange={(e) => setJoiningRefNo(e.target.value)}
                    placeholder="e.g. JL/2026/001"
                  />
                </div>
                <div className="info-item">
                  <label>Issue Date</label>
                  <DatePicker
                    style={{ width: "100%", marginTop: "4px" }}
                    value={joiningIssueDate ? dayjs(joiningIssueDate) : null}
                    onChange={(date) =>
                      setJoiningIssueDate(date ? date.format("YYYY-MM-DD") : "")
                    }
                  />
                </div>
              </div>
              <div style={{ marginTop: "20px" }}>
                <button
                  className="btn-premium-wide"
                  onClick={handleJoiningGenerate}
                  disabled={generatingJoining}
                >
                  {generatingJoining ? "Generating..." : "Download PDF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <EmployeeExcelUploadModal
        isOpen={openUploadPopup}
        onClose={() => setOpenUploadPopup(false)}
        onSuccess={(result) => {
          setOpenUploadPopup(false);
          const uploadedCount = Number(result?.uploadedCount || 0);
          const failedCount = Number(result?.failedCount || 0);

          if (uploadedCount > 0 && failedCount > 0) {
            showToast(
              "warning",
              "Upload Completed with Issues",
              `${uploadedCount} employee(s) were uploaded. ${failedCount} record(s) could not be processed. Please review the upload report.`,
              6
            );
          } else {
            showToast(
              "success",
              "Employees Uploaded",
              `${uploadedCount} employee(s) uploaded successfully.`
            );
          }
          load();
        }}
      />
      </div>
    </div>
  );
}



