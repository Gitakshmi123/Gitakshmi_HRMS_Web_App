/**
 * HrmsRoutes.jsx
 * COMPLETELY ISOLATED routing for HRMS system
 * INCLUDES: SuperAdmin, HR Admin, Employee, Manager
 * NO Job Portal components or auth
 */
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet, useParams } from 'react-router-dom';

// Layouts
const PsaLayout = lazy(() => import('../layouts/PsaLayout'));
const HrLayout = lazy(() => import('../layouts/HrLayout'));
const EssLayout = lazy(() => import('../layouts/EssLayout'));
import Loader from '../components/common/Loader';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import ProtectedModule from '../components/common/ProtectedModule';
import { useAuth } from '../context/AuthContext';
import { useRBAC } from '../context/RBACContext';
import PrivateRoute from '../components/auth/PrivateRoute';
import {
  isPrivilegedManagementRole,
  resolveFirstAllowedEmployeePath,
} from '../utils/employeeAccess';

// Auth Pages (Moved to RootRouter)

// PSA Pages
const Dashboard = lazy(() => import('../pages/PSA/Dashboard'));
const CompanyList = lazy(() => import('../pages/PSA/CompanyList'));
const AddCompany = lazy(() => import('../pages/PSA/AddCompany'));
const EditCompany = lazy(() => import('../pages/PSA/EditCompany'));
const ViewCompany = lazy(() => import('../pages/PSA/ViewCompany'));
const ModuleConfig = lazy(() => import('../pages/PSA/ModuleConfig'));
const Activities = lazy(() => import('../pages/PSA/Activities'));
const Notifications = lazy(() => import('../pages/PSA/Notifications'));

// HR Pages
const HRDashboard = lazy(() => import('../pages/HR/HRDashboard'));
const Employees = lazy(() => import('../pages/HR/Employees'));
const EmployeeProfile = lazy(() => import('../pages/HR/EmployeeProfile'));
const EmployeeFormPage = lazy(() => import('../pages/HR/EmployeeFormPage'));
const ExternalRecords = lazy(() => import('../pages/HR/ExternalRecords'));
const Departments = lazy(() => import('../pages/HR/Departments'));
const LeavePolicies = lazy(() => import('../pages/HR/LeavePolicies'));
const LeaveApprovals = lazy(() => import('../pages/HR/LeaveApprovals'));
const RegularizationApprovals = lazy(() => import('../pages/HR/RegularizationApprovals'));
const OrgStructure = lazy(() => import('../pages/HR/OrgStructure'));
const UserManagement = lazy(() => import('../pages/HR/UserManagement'));
const CeoOrg = lazy(() => import('../pages/HR/CeoOrg'));
const AccessControl = lazy(() => import('../pages/HR/AccessControl'));
const SidebarCustomizationPage = lazy(() => import('../pages/HR/SidebarCustomizationPage'));
const OfferTemplates = lazy(() => import('../pages/HR/OfferTemplates'));
const RequirementPage = lazy(() => import('../pages/HR/RequirementPage'));
const Applicants = lazy(() => import('../pages/HR/Applicants'));
const AttendanceAdmin = lazy(() => import('../pages/HR/AttendanceAdmin'));
const CalendarManagement = lazy(() => import('../pages/HR/CalendarManagement'));
const CandidateStatusTracker = lazy(() => import('../pages/HR/CandidateStatusTracker'));
const CandidateTimeline = lazy(() => import('../pages/HR/CandidateStatusTracker/CandidateTimeline'));
const PayslipTemplates = lazy(() => import('../pages/HR/Payroll/PayslipTemplates'));
const PayslipBuilder = lazy(() => import('../pages/HR/Payroll/PayslipBuilder/PayslipBuilder'));
const AttendanceHistory = lazy(() => import('../pages/HR/AttendanceHistory'));
const FaceUpdateRequests = lazy(() => import('../pages/HR/FaceUpdateRequests'));
const Compensation = lazy(() => import('../pages/HR/Compensation'));
const OfferJoiningManager = lazy(() => import('../pages/HR/OfferJoiningManager'));
const ShiftManagement = lazy(() => import('../pages/ShiftManagement'));

// New Attendance Modules
const AttendanceLayout = lazy(() => import('../layouts/AttendanceLayout'));
const AttendanceDashboard = lazy(() => import('../pages/HR/Attendance/AttendanceDashboard'));
const AttendanceSheet = lazy(() => import('../pages/HR/Attendance/AttendanceSheet'));
const DailyAttendance = lazy(() => import('../pages/HR/Attendance/DailyAttendance'));
const AttendanceSummary = lazy(() => import('../pages/HR/Attendance/AttendanceSummary'));
const RegularizationRequest = lazy(() => import('../pages/HR/Attendance/RegularizationRequest'));
const AttendanceApproval = lazy(() => import('../pages/HR/Attendance/AttendanceApproval'));
const AttendanceLock = lazy(() => import('../pages/HR/Attendance/AttendanceLock'));
const HolidayCalendar = lazy(() => import('../pages/HR/Attendance/HolidayCalendar'));
const ShiftRoster = lazy(() => import('../pages/HR/Attendance/ShiftRoster'));
const AttendanceReports = lazy(() => import('../pages/HR/Attendance/AttendanceReports'));
const MusterRoll = lazy(() => import('../pages/HR/Attendance/MusterRoll'));

// Letter modules
const LetterDashboard = lazy(() => import('../pages/HR/Letters/LetterDashboard'));
const IssueLetterWizard = lazy(() => import('../pages/HR/Letters/IssueLetterWizard'));
const LetterTemplates = lazy(() => import('../pages/HR/LetterTemplates'));
const LetterSettings = lazy(() => import('../pages/HR/LetterSettings'));
const TemplatePreview = lazy(() => import('../pages/HR/TemplatePreview'));
const SalaryStructure = lazy(() => import('../pages/HR/SalaryStructure'));
const CreateRequirement = lazy(() => import('../pages/HR/CreateRequirement'));
const PositionMaster = lazy(() => import('../pages/HR/PositionMaster'));
const VendorList = lazy(() => import('../pages/HR/VendorList'));
const VendorFormStep1 = lazy(() => import('../pages/HR/VendorFormStep1'));
const VendorFormStep2 = lazy(() => import('../pages/HR/VendorFormStep2'));
const VendorDetails = lazy(() => import('../pages/HR/VendorDetails'));

// Settings
const CompanySettings = lazy(() => import('../pages/settings/CompanySettings'));
const EmailTemplates = lazy(() => import('../pages/settings/EmailTemplates'));
const Automations = lazy(() => import('../pages/Organization/Automations'));
const SocialMediaPage = lazy(() => import('../pages/settings/SocialMediaPage'));
const PersonnelReports = lazy(() => import('../pages/HR/PersonnelReports'));
const SupportAdmin = lazy(() => import('../pages/HR/SupportAdmin'));
const BGVManagement = lazy(() => import('../pages/HR/BGVManagement'));
const BGVEmailManagement = lazy(() => import('../pages/HR/BGVEmailManagement'));
const SubCompanyList = lazy(() => import('../pages/HR/SubCompanyList'));
const SubCompanyAdd = lazy(() => import('../pages/HR/SubCompanyAdd'));
const BranchList = lazy(() => import('../pages/HR/BranchList'));
const BranchAdd = lazy(() => import('../pages/HR/BranchAdd'));
const Organization = lazy(() => import('../pages/Organization'));
const GradeManagement = lazy(() => import('../pages/HR/Grades/GradeManagement'));

// Career Builder
const CareerBuilder = lazy(() => import('../pages/HR/CareerBuilder/CareerBuilder'));
const ApplyPageBuilder = lazy(() => import('../pages/HR/CareerBuilder/ApplyPageBuilder'));
const LetterBuilder = lazy(() => import('../pages/HR/LetterBuilder/LetterBuilder'));

// Payroll
const SalaryComponents = lazy(() => import('../pages/HR/Payroll/SalaryComponents'));
const NewEarning = lazy(() => import('../pages/HR/Payroll/NewEarning'));
const NewBenefit = lazy(() => import('../pages/HR/Payroll/NewBenefit'));
const NewSalaryTemplate = lazy(() => import('../pages/HR/Payroll/NewSalaryTemplate'));
const NewDeduction = lazy(() => import('../pages/HR/Payroll/Deductions/NewDeduction'));
const PayrollRules = lazy(() => import('../pages/Admin/PayrollRules'));
const RunPayroll = lazy(() => import('../pages/HR/Payroll/RunPayroll'));
const Payslips = lazy(() => import('../pages/HR/Payroll/Payslips'));
const ProcessPayroll = lazy(() => import('../pages/HR/Payroll/ProcessPayroll'));
const PayrollDashboard = lazy(() => import('../pages/HR/Payroll/PayrollDashboard'));
const SalaryAssignmentExcel = lazy(() => import('../pages/HR/Payroll/SalaryAssignmentExcel'));
const MinimumWageMaster = lazy(() => import('../pages/HR/Payroll/MinimumWageMaster'));
const PayrollReport = lazy(() => import('../pages/HR/Payroll/PayrollReport'));
const EmployeePayroll = lazy(() => import('../pages/HR/Payroll/SalaryAssignmentExcel'));
const PayslipView = lazy(() => import('../pages/HR/Payroll/PayslipView'));
const Arrears = lazy(() => import('../pages/HR/Payroll/Arrears'));
const Reimbursements = lazy(() => import('../pages/HR/Payroll/Reimbursements'));
const LoansAdvances = lazy(() => import('../pages/HR/Payroll/LoansAdvances'));
const DeductionEntry = lazy(() => import('../pages/HR/Payroll/DeductionEntry'));
const TdsDeclarations = lazy(() => import('../pages/HR/Payroll/TdsDeclarations'));
const OtherEarnings = lazy(() => import('../pages/HR/Payroll/OtherEarnings'));
const Form16 = lazy(() => import('../pages/HR/Payroll/Form16'));
const SalaryRevision = lazy(() => import('../pages/HR/Compensation'));

// Employee Self-Service
const ESSPayslips = lazy(() => import('../pages/ESS/Payslips'));

// Onboarding Pages
const OnboardingDashboard = lazy(() => import('../pages/Onboarding/OnboardingDashboard'));
const OnboardingInstances = lazy(() => import('../pages/Onboarding/OnboardingInstances'));
const OnboardingTemplates = lazy(() => import('../pages/Onboarding/OnboardingTemplates'));
const OnboardingTaskBoard = lazy(() => import('../pages/Onboarding/OnboardingTaskBoard'));
const EmployeeOnboardingForm = lazy(() => import('../pages/Onboarding/EmployeeOnboardingForm'));
const HRApprovalPage = lazy(() => import('../pages/Onboarding/HRApprovalPage'));
const ApprovalsDashboard = lazy(() => import('../pages/Approvals/ApprovalsDashboard'));

// 🔥 NEW: BGV Pages
const MyTasks = lazy(() => import('../pages/HR/BGV/MyTasks'));

// Employee
const EmployeeDashboard = lazy(() => import('../pages/Employee/EmployeeDashboard'));
const MyTickets = lazy(() => import('../pages/Employee/MyTickets'));
const MyDocuments = lazy(() => import('../pages/Employee/MyDocuments'));
const InternalJobs = lazy(() => import('../pages/Employee/InternalJobs'));
const EmployeeProfileView = lazy(() => import('../components/EmployeeProfileView'));
const FaceAttendance = lazy(() => import('../pages/Employee/FaceAttendance'));
const ManpowerRequisitionList = lazy(() => import('../pages/ESS/ManpowerRequisition/ManpowerRequisitionList'));
const ManpowerRequisitionForm = lazy(() => import('../pages/ESS/ManpowerRequisition/ManpowerRequisitionForm'));

// Exit Module
const ExitManagement = lazy(() => import('../pages/exit/ExitManagement'));
const EmployeeExit = lazy(() => import('../pages/exit/EmployeeExit'));

// Global
const EntityDetail = lazy(() => import('../pages/Global/EntityDetail'));
const MyRequests = lazy(() => import('../pages/Global/MyRequests'));
const NotFound = lazy(() => import('../pages/NotFound'));
const VerifyCompany = lazy(() => import('../pages/VerifyCompany'));

// Helper for Outlet
const OutletProxy = () => <Outlet />;

// Local Dynamic Guards
const SmartSettingsRoute = ({ forceTab }) => <CompanySettings forceTab={forceTab} />;
const RBACRoute = ({ children, module, action = 'view' }) => (
  <ProtectedModule
    // Module toggles are meant for major product modules (attendance/payroll/etc).
    // For ESS pages we treat `module` as an RBAC permission key (e.g. "employee.jobs").
    module="employeePortal"
    permissionKey={module}
    action={action}
  >
    {children}
  </ProtectedModule>
);

function EmployeeLandingEntry() {
  const { hasPermission, loading, permissions } = useRBAC();

  if (loading && !permissions) return null;

  const targetPath = resolveFirstAllowedEmployeePath(hasPermission);
  return <Navigate to={targetPath || '/'} replace />;
}

function EmployeePermissionRoute({ children, permissionKey, module = 'employeePortal', action = 'view' }) {
  const { hasPermission, loading, permissions, user } = useRBAC();
  const location = useLocation();

  if (loading && !permissions) return null;

  const roleName = String(user?.roleName || user?.role || '').toLowerCase();
  const isPrivileged = isPrivilegedManagementRole(roleName);

  const isAllowed = isPrivileged || (action === 'view'
    ? (hasPermission(permissionKey, 'view') || hasPermission(permissionKey, 'any'))
    : hasPermission(permissionKey, action));

  if (!isAllowed) {
    const fallbackPath = resolveFirstAllowedEmployeePath(hasPermission);
    if (fallbackPath && fallbackPath !== location.pathname) {
      return <Navigate to={fallbackPath} replace />;
    }
    return <Navigate to={fallbackPath || '/'} replace />;
  }

  return (
    <ProtectedModule module={module} permissionKey={permissionKey} action={action}>
      {children}
    </ProtectedModule>
  );
}

function PayslipBuilderAliasRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/hr/payroll/payslip-builder/${id}` : `/hr/payroll/payslip-builder/new`} replace />;
}


function DashboardEntry() {
  const { user } = useAuth();
  const roleName = String(user?.roleName || user?.role || "").toLowerCase();
  
  if (roleName === "psa" || roleName === "super_admin") {
    return <Navigate to="/psa" replace />;
  }
  
  if (isPrivilegedManagementRole(roleName)) {
    return <Navigate to="/hr" replace />;
  }
  
  return <Navigate to="/employee" replace />;
}

/**
 * HRMS Routes - PSA + HR + Employee
 * Prefix: /*
 */
// Internal routing components
const RedirectWithId = ({ toPrefix }) => {
  const { id } = useParams();
  return <Navigate to={`${toPrefix}/${id}`} replace />;
};

export default function HrmsRoutes() {
  const afterLogoutRedirect = "/login";

  return (
    <Suspense fallback={<Loader fullPage title="Loading Component" subtitle="Please wait while we prepare the view..." />}>
      <Routes>
        {/* SSO compatibility aliases */}
        <Route path="after-logout" element={<Navigate to={afterLogoutRedirect} replace />} />
        <Route path="dashboard" element={<PrivateRoute><DashboardEntry /></PrivateRoute>} />
        <Route path="tenant/admin-dashboard" element={<PrivateRoute><DashboardEntry /></PrivateRoute>} />
        <Route path="tenant/dashboard" element={<PrivateRoute><DashboardEntry /></PrivateRoute>} />
      <Route path="super_admin" element={<Navigate to="/psa" replace />} />
      <Route path="super_admin/dashboard" element={<Navigate to="/psa" replace />} />
      <Route path="super_admin/companies" element={<Navigate to="/psa/companies" replace />} />
      <Route path="super_admin/companies/add" element={<Navigate to="/psa/companies/add" replace />} />
      <Route path="super_admin/companies/edit/:id" element={<RedirectWithId toPrefix="/psa/companies/edit" />} />
      <Route path="super_admin/companies/view/:id" element={<RedirectWithId toPrefix="/psa/companies/view" />} />
      <Route path="super_admin/modules" element={<Navigate to="/psa/modules" replace />} />
      <Route path="super_admin/modules/:id" element={<RedirectWithId toPrefix="/psa/modules" />} />
      <Route path="super_admin/activities" element={<Navigate to="/psa/activities" replace />} />

      <Route path="super-admin" element={<Navigate to="/psa" replace />} />
      <Route path="super-admin/dashboard" element={<Navigate to="/psa" replace />} />
      <Route path="super-admin/companies" element={<Navigate to="/psa/companies" replace />} />
      <Route path="super-admin/companies/add" element={<Navigate to="/psa/companies/add" replace />} />
      <Route path="super-admin/companies/edit/:id" element={<RedirectWithId toPrefix="/psa/companies/edit" />} />
      <Route path="super-admin/companies/view/:id" element={<RedirectWithId toPrefix="/psa/companies/view" />} />
      <Route path="super-admin/modules" element={<Navigate to="/psa/modules" replace />} />
      <Route path="super-admin/modules/:id" element={<RedirectWithId toPrefix="/psa/modules" />} />
      <Route path="super-admin/activities" element={<Navigate to="/psa/activities" replace />} />

      <Route
        path="psa"
        element={
          <ProtectedRoute allowedRoles={['psa', 'super_admin']}>
            <PsaLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<CompanyList />} />
        <Route path="companies/add" element={<AddCompany />} />
        <Route path="companies/edit/:id" element={<EditCompany />} />
        <Route path="companies/view/:id" element={<ViewCompany />} />
        <Route path="modules" element={<ModuleConfig />} />
        <Route path="modules/:id" element={<ModuleConfig />} />
        <Route path="activities" element={<Activities />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      {/* HR (ADMIN) ROUTES */}
      <Route
        path="hr"
        element={
          <ProtectedRoute allowedRoles={['hr', 'admin', 'company_admin', 'company_super_admin', 'sub_company_admin', 'branch_head', 'division_head', 'department_head', 'designation_head']}>
            <HrLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HRDashboard />} />
        <Route path="dashboard" element={<HRDashboard />} />
        <Route path="my-dashboard" element={<EmployeeDashboard />} />
        <Route path="my-attendance" element={<EmployeeDashboard />} />
        <Route path="my-payslips" element={<ESSPayslips />} />
        <Route
          path="my-documents"
          element={
            <RBACRoute module="employee.documents">
              <MyDocuments />
            </RBACRoute>
          }
        />
        <Route
          path="internal-jobs"
          element={
            <RBACRoute module="employee.jobs">
              <InternalJobs />
            </RBACRoute>
          }
        />
        <Route
          path="resignation"
          element={
            <RBACRoute module="employee.exit">
              <EmployeeExit />
            </RBACRoute>
          }
        />
        <Route path="exit-management" element={<ProtectedModule module="hr" permissionKey="offboarding.exit"><ExitManagement /></ProtectedModule>} />
        <Route path="reports" element={<ProtectedModule module="reports" permissionKey="reports.staffing"><PersonnelReports /></ProtectedModule>} />
        <Route
          path="reports/replacements"
          element={
            <RBACRoute module="reports.movements">
              <PersonnelReports />
            </RBACRoute>
          }
        />
        <Route
          path="reports/trends"
          element={
            <RBACRoute module="reports.trends">
              <PersonnelReports />
            </RBACRoute>
          }
        />
        <Route
          path="reports/performance"
          element={
            <RBACRoute module="reports.performance">
              <PersonnelReports />
            </RBACRoute>
          }
        />
        <Route
          path="support-center"
          element={
            <RBACRoute module="employee.tickets">
              <MyTickets />
            </RBACRoute>
          }
        />
        <Route path="tickets" element={<ProtectedModule module="hr" permissionKey="support.tickets"><SupportAdmin /></ProtectedModule>} />
        <Route path="bgv" element={<ProtectedModule module="backgroundVerification"><BGVManagement /></ProtectedModule>} />
        <Route
          path="bgv/emails"
          element={
            <RBACRoute module="bgv.emailLogs">
              <BGVEmailManagement />
            </RBACRoute>
          }
        />
        <Route
          path="sub-companies"
          element={
            <Navigate to="/hr/organization" replace />
          }
        />
        <Route
          path="branches"
          element={
            <Navigate to="/hr/organization" replace />
          }
        />
        <Route
          path="branches/new"
          element={
            <Navigate to="/hr/organization" replace />
          }
        />
        <Route
          path="organization"
          element={
            <RBACRoute module="hr" permissionKey="people.org">
              <Organization />
            </RBACRoute>
          }
        />
        <Route
          path="organization/automations"
          element={
            <RBACRoute module="hr" permissionKey="people.org">
              <Automations />
            </RBACRoute>
          }
        />
        <Route
          path="grades"
          element={
            <RBACRoute module="hr" permissionKey="people.org">
              <GradeManagement />
            </RBACRoute>
          }
        />
        <Route
          path="sub-companies/new"
          element={
            <Navigate to="/hr/organization" replace />
          }
        />
        <Route path="social-media" element={<Navigate to="/hr/settings/social-media" replace />} />
        <Route path="settings" element={<Navigate to="/hr/settings/company" replace />} />
        <Route path="settings/company" element={<CompanySettings />} />
        <Route path="settings/dms-integration" element={<CompanySettings forceTab="dms" />} />
        <Route path="settings/email-templates" element={<EmailTemplates />} />
        <Route path="settings/social-media" element={<ProtectedModule module="socialMediaIntegration" permissionKey="socialMedia.dashboard"><SocialMediaPage /></ProtectedModule>} />
        <Route
          path="settings/social-media/accounts"
          element={
            <RBACRoute module="socialMedia.accounts">
              <SocialMediaPage />
            </RBACRoute>
          }
        />
        <Route
          path="settings/social-media/create"
          element={
            <RBACRoute module="socialMedia.create">
              <SocialMediaPage />
            </RBACRoute>
          }
        />
        <Route
          path="settings/social-media/history"
          element={
            <RBACRoute module="socialMedia.history">
              <SocialMediaPage />
            </RBACRoute>
          }
        />
        {/* --- HR MODULE --- */}
        <Route element={<ProtectedModule module="hr"><Outlet /></ProtectedModule>}>
          <Route path="employees" element={<Employees />} />
          <Route path="external-records" element={<ExternalRecords />} />
          <Route path="employees/new" element={<EmployeeFormPage />} />
          <Route path="employees/:employeeId/profile" element={<EmployeeProfile />} />
          <Route path="employees/:employeeId/edit" element={<EmployeeFormPage />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="departments" element={<Departments />} />
          <Route path="leaves" element={<Navigate to="leave-approvals" replace />} />
          <Route path="leave-approvals" element={<ProtectedModule module="leave" permissionKey="leave.requests"><LeaveApprovals /></ProtectedModule>} />
          <Route path="leave-approvals/regularization" element={<ProtectedModule module="leave" permissionKey="leave.requests"><RegularizationApprovals category="Leave" /></ProtectedModule>} />
          <Route path="leave-policies" element={<ProtectedModule module="leave" permissionKey="leave.policies"><LeavePolicies mode="master" /></ProtectedModule>} />
          <Route path="leave-policies/custom" element={<ProtectedModule module="leave" permissionKey="leave.custom"><LeavePolicies mode="master" initialView="custom" /></ProtectedModule>} />
          <Route path="organization-policies" element={<ProtectedModule module="leave" permissionKey="leave.policies"><LeavePolicies mode="config" /></ProtectedModule>} />
          <Route path="org" element={<OrgStructure />} />
          <Route path="org-tree" element={<CeoOrg />} />
          <Route path="access" element={<ProtectedModule module="accessControl" permissionKey="configuration.access"><AccessControl /></ProtectedModule>} />
          <Route path="approvals" element={<ProtectedModule module="hr" permissionKey="approval.view"><ApprovalsDashboard /></ProtectedModule>} />
          <Route path="sidebar-customization" element={<ProtectedModule module="hr" permissionKey="configuration.access"><SidebarCustomizationPage /></ProtectedModule>} />
          <Route path="settings/company" element={<SmartSettingsRoute forceTab="company" />} />
          <Route path="settings/sequences" element={<SmartSettingsRoute forceTab="sequences" />} />

          {/* Letters */}
          <Route path="letters" element={<ProtectedModule module="documentManagement" permissionKey="documents.dashboard"><LetterDashboard /></ProtectedModule>} />
          <Route path="letters/issue" element={<ProtectedModule module="documentManagement" permissionKey="documents.issue"><IssueLetterWizard /></ProtectedModule>} />
          <Route path="letter-templates" element={<ProtectedModule module="documentManagement" permissionKey="documents.templates"><LetterTemplates /></ProtectedModule>} />
          <Route path="letter-templates/:templateId/preview" element={<TemplatePreview />} />
          <Route path="letter-settings" element={<ProtectedModule module="documentManagement" permissionKey="documents.settings"><LetterSettings /></ProtectedModule>} />
          <Route path="letter-builder/new" element={<LetterBuilder />} />
          <Route path="letter-builder/:id" element={<LetterBuilder />} />

          <Route path="my-tasks" element={<ProtectedModule module="backgroundVerification"><MyTasks /></ProtectedModule>} />
          <Route path="payslip-templates" element={<ProtectedModule module="payroll" permissionKey="payroll.payslips"><PayslipTemplates /></ProtectedModule>} />
          
          <Route path="manpower-requisition" element={<ProtectedModule module="recruitment" permissionKey="hiring.createReq"><ManpowerRequisitionList /></ProtectedModule>} />
          <Route path="manpower-requisition/:id" element={<ProtectedModule module="recruitment" permissionKey="hiring.createReq"><ManpowerRequisitionForm /></ProtectedModule>} />
          <Route path="manpower_requisition" element={<Navigate to="manpower-requisition" replace />} />
        </Route>

        {/* --- ATTENDANCE MODULE --- */}
        <Route element={<ProtectedModule module="attendance"><AttendanceLayout /></ProtectedModule>}>
          {/* New Modules */}
          <Route path="attendance-dashboard" element={<AttendanceDashboard />} />
          <Route path="attendance-sheet" element={<AttendanceSheet />} />
          <Route path="daily-attendance" element={<DailyAttendance />} />
          <Route path="attendance-summary" element={<AttendanceSummary />} />
          <Route path="regularization-request" element={<RegularizationRequest />} />
          <Route path="attendance-approval" element={<AttendanceApproval />} />
          <Route path="attendance-lock" element={<AttendanceLock />} />
          <Route path="muster-roll" element={<MusterRoll />} />
          <Route path="holiday-calendar" element={<HolidayCalendar />} />
          <Route path="shift-roster" element={<ShiftRoster />} />
          <Route path="attendance-reports" element={<AttendanceReports />} />
          
          {/* Legacy Modules Preserved */}
          <Route path="shift-management" element={<ShiftManagement />} />
          <Route path="attendance" element={<AttendanceAdmin />} />
          <Route path="attendance/live-tracking" element={<AttendanceAdmin forceView="liveTracking" />} />
          <Route path="attendance/settings" element={<AttendanceAdmin forceView="settings" />} />
          <Route path="attendance/correction" element={<RegularizationApprovals category="Attendance" />} />
          <Route path="attendance-calendar" element={<CalendarManagement />} />
          <Route path="attendance-history" element={<AttendanceHistory />} />
          <Route path="face-attendance" element={<FaceAttendance />} />
        </Route>

        {/* --- RECRUITMENT MODULE --- */}
        <Route element={<ProtectedModule module="recruitment"><Outlet /></ProtectedModule>}>
          <Route path="requirements" element={<RequirementPage />} />
          <Route path="create-requirement" element={<CreateRequirement />} />
          <Route path="position-master" element={<PositionMaster />} />
          <Route path="positions" element={<PositionMaster />} />
          <Route path="applicants" element={<Applicants />} />
          <Route
            path="offers-joining"
            element={
              <ProtectedModule module="recruitment" permissionKey="hiring.offersJoining">
                <OfferJoiningManager />
              </ProtectedModule>
            }
          />
          <Route path="job/:jobId/candidates" element={<Applicants jobSpecific={true} />} />
          <Route path="internal-applicants/job/:jobId/candidates" element={<Applicants internalMode={true} jobSpecific={true} />} />
          <Route path="internal-applicants" element={<Applicants internalMode={true} />} />
          <Route path="candidate-status" element={<CandidateStatusTracker />} />
          <Route path="candidate-status/:id" element={<CandidateTimeline />} />
          <Route
            path="offer-templates"
            element={
              <ProtectedModule module="recruitment" permissionKey="hiring.offerTemplates">
                <LetterTemplates />
              </ProtectedModule>
            }
          />

          {/* Vendor Management */}
          <Route path="vendor/list" element={<VendorList />} />
          <Route path="vendor/step1" element={<VendorFormStep1 />} />
          <Route path="vendor/step2/:vendorId" element={<VendorFormStep2 />} />
          <Route path="vendor/details/:id" element={<VendorDetails />} />

          {/* Career Builder */}
          <Route path="career-builder" element={<CareerBuilder />} />
          <Route path="apply-builder" element={<ApplyPageBuilder />} />
        </Route>

        {/* --- PAYROLL MODULE --- */}
        <Route element={<ProtectedModule module="payroll"><Outlet /></ProtectedModule>}>
          <Route path="salary-structure/:candidateId" element={<SalaryStructure />} />
          <Route path="payroll/dashboard" element={<PayrollDashboard />} />
          <Route path="payroll/salary-components" element={<SalaryComponents />} />
          <Route
            path="payroll/compensation"
            element={
              <RBACRoute module="payroll.compensation">
                <Compensation />
              </RBACRoute>
            }
          />
          <Route path="payroll/earnings/new" element={<NewEarning />} />
          <Route path="payroll/earnings/edit/:id" element={<NewEarning />} />
          <Route path="payroll/deductions/new" element={<NewDeduction />} />
          <Route path="payroll/deductions/edit/:id" element={<NewDeduction />} />
          <Route path="payroll/benefits/new" element={<NewBenefit />} />
          <Route path="payroll/benefits/edit/:id" element={<NewBenefit />} />
          <Route path="payroll/salary-templates/new" element={<NewSalaryTemplate />} />
          <Route path="payroll/rules" element={<PayrollRules />} />
          <Route path="payroll/minimum-wage" element={<MinimumWageMaster />} />
          <Route path="payroll/process" element={<ProcessPayroll />} />
          <Route path="payroll/run" element={<RunPayroll />} />
          <Route path="payroll/payslips" element={<Payslips />} />
          <Route path="payroll/reports" element={<PayrollReport />} />
          <Route path="payroll/payslip-templates" element={<PayslipTemplates />} />
          <Route path="payroll/salary-assignment-excel" element={<SalaryAssignmentExcel />} />
          <Route path="payroll/employee-payroll" element={<EmployeePayroll />} />
          <Route path="payroll/payslip-view" element={<PayslipView />} />
          <Route path="payroll/arrears" element={<Arrears />} />
          <Route path="payroll/reimbursements" element={<Reimbursements />} />
          <Route path="payroll/loans" element={<LoansAdvances />} />
          <Route path="payroll/deduction-entry" element={<DeductionEntry />} />
          <Route path="payroll/tds-declaration" element={<TdsDeclarations />} />
          <Route path="payroll/other-earnings" element={<OtherEarnings />} />
          <Route path="payroll/form16" element={<Form16 />} />
          <Route path="payroll/salary-revision" element={<SalaryRevision />} />

          {/* Payslip Builder */}
          <Route
            path="payroll/payslip-builder/new"
            element={<ProtectedModule module="payroll" permissionKey="payroll.payslips" action="create"><PayslipBuilder /></ProtectedModule>}
          />
          <Route
            path="payroll/payslip-builder/:id"
            element={<ProtectedModule module="payroll" permissionKey="payroll.payslips" action="edit"><PayslipBuilder /></ProtectedModule>}
          />

          {/* Backward/typo aliases (space instead of dash) */}
          <Route path="payroll/payslip builder/new" element={<PayslipBuilderAliasRedirect />} />
          <Route path="payroll/payslip builder/:id" element={<PayslipBuilderAliasRedirect />} />
        </Route>

        {/* --- ONBOARDING MODULE --- */}
        <Route element={<ProtectedModule module="onboarding"><Outlet /></ProtectedModule>}>
          <Route path="onboarding/dashboard" element={<OnboardingDashboard />} />
          <Route path="onboarding/pipeline" element={<OnboardingDashboard />} />
          <Route path="onboarding/templates" element={<OnboardingTemplates />} />
          <Route path="onboarding/instances" element={<OnboardingInstances />} />
          <Route path="onboarding/tasks" element={<OnboardingTaskBoard />} />
          <Route path="onboarding/verifications" element={<HRApprovalPage />} />
        </Route>

        {/* Global inside HR */}
        <Route path="details/:entityType/:entityId" element={<EntityDetail />} />
        <Route path="my-requests" element={<MyRequests />} />
        <Route path="face-attendance" element={<FaceAttendance />} />
        <Route
          path="face-update-requests"
          element={
            <RBACRoute module="attendance.face">
              <FaceUpdateRequests />
            </RBACRoute>
          }
        />
      </Route>

      {/* EMPLOYEE / MANAGER ROUTES */}
      <Route
        path="employee"
        element={
          <ProtectedRoute allowedRoles={['employee', 'manager', 'hr', 'admin', 'company_super_admin', 'human_resource', 'psa', 'company_admin']}>
            <EssLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeLandingEntry />} />
        <Route
          path="dashboard"
          element={
            <EmployeePermissionRoute permissionKey="employee.dashboard">
              <EmployeeDashboard />
            </EmployeePermissionRoute>
          }
        />
        <Route
          path="hr-dashboard"
          element={
            <EmployeePermissionRoute module="hr" permissionKey="overview.dashboard">
              <HRDashboard />
            </EmployeePermissionRoute>
          }
        />
        <Route
          path="attendance"
          element={
            <EmployeePermissionRoute permissionKey="employee.attendance">
              <EmployeeDashboard />
            </EmployeePermissionRoute>
          }
        />
        <Route
          path="attendance-calendar"
          element={
            <EmployeePermissionRoute module="attendance" permissionKey="attendance.calendar">
              <CalendarManagement />
            </EmployeePermissionRoute>
          }
        />
        <Route
          path="face-update-requests"
          element={
            <EmployeePermissionRoute module="attendance" permissionKey="attendance.face">
              <FaceUpdateRequests />
            </EmployeePermissionRoute>
          }
        />
        <Route
          path="attendance-history"
          element={
            <EmployeePermissionRoute module="attendance" permissionKey="attendance.dashboard">
              <AttendanceAdmin forceView="history" />
            </EmployeePermissionRoute>
          }
        />
        <Route
          path="attendance-live-tracking"
          element={
            <EmployeePermissionRoute module="attendance" permissionKey="attendance.dashboard">
              <AttendanceAdmin forceView="liveTracking" />
            </EmployeePermissionRoute>
          }
        />
        <Route
          path="attendance-settings"
          element={
            <EmployeePermissionRoute module="attendance" permissionKey="attendance.dashboard">
              <AttendanceAdmin forceView="settings" />
            </EmployeePermissionRoute>
          }
        />
        <Route
          path="access"
          element={
            <EmployeePermissionRoute module="accessControl" permissionKey="configuration.access">
              <AccessControl />
            </EmployeePermissionRoute>
          }
        />
        <Route element={<ProtectedModule module="hr"><Outlet /></ProtectedModule>}>
          <Route path="employees" element={<EmployeePermissionRoute module="hr" permissionKey={['people.employees', 'people.directory']}><Employees /></EmployeePermissionRoute>} />
          <Route path="external-records" element={<EmployeePermissionRoute module="hr" permissionKey={['people.employees', 'people.directory']}><ExternalRecords /></EmployeePermissionRoute>} />
          <Route path="employees/new" element={<EmployeePermissionRoute module="hr" permissionKey={['people.employees']}><EmployeeFormPage /></EmployeePermissionRoute>} />
          <Route path="employees/:employeeId/profile" element={<EmployeePermissionRoute module="hr" permissionKey="people.employees"><EmployeeProfile /></EmployeePermissionRoute>} />
          <Route path="employees/:employeeId/edit" element={<EmployeePermissionRoute module="hr" permissionKey="people.employees" action="edit"><EmployeeFormPage /></EmployeePermissionRoute>} />
          <Route path="departments" element={<EmployeePermissionRoute module="hr" permissionKey="people.departments"><Departments /></EmployeePermissionRoute>} />
          <Route path="org" element={<EmployeePermissionRoute module="hr" permissionKey="people.org"><OrgStructure /></EmployeePermissionRoute>} />
          <Route path="users" element={<EmployeePermissionRoute module="hr" permissionKey="people.users"><UserManagement /></EmployeePermissionRoute>} />
          <Route path="leave-approvals" element={<EmployeePermissionRoute module="hr" permissionKey="leave.requests"><LeaveApprovals /></EmployeePermissionRoute>} />
          <Route path="leave-policies" element={<EmployeePermissionRoute module="hr" permissionKey="leave.policies"><LeavePolicies mode="master" /></EmployeePermissionRoute>} />
          <Route path="leave-policies/custom" element={<EmployeePermissionRoute module="hr" permissionKey="leave.custom"><LeavePolicies mode="master" initialView="custom" /></EmployeePermissionRoute>} />
          <Route path="organization-policies" element={<EmployeePermissionRoute module="hr" permissionKey="leave.policies"><LeavePolicies mode="config" /></EmployeePermissionRoute>} />
          <Route path="exit-management" element={<EmployeePermissionRoute module="hr" permissionKey="offboarding.exit"><ExitManagement /></EmployeePermissionRoute>} />
          <Route path="reports" element={<EmployeePermissionRoute module="hr" permissionKey="reports.staffing"><PersonnelReports /></EmployeePermissionRoute>} />
          <Route path="reports/replacements" element={<RBACRoute module="reports.movements"><PersonnelReports /></RBACRoute>} />
          <Route path="reports/trends" element={<RBACRoute module="reports.trends"><PersonnelReports /></RBACRoute>} />
          <Route path="reports/performance" element={<RBACRoute module="reports.performance"><PersonnelReports /></RBACRoute>} />
          <Route path="sub-companies" element={<Navigate to="/hr/organization" replace />} />
          <Route path="sub-companies/new" element={<Navigate to="/hr/organization" replace />} />
          <Route path="organization" element={<EmployeePermissionRoute module="hr" permissionKey={['company.subCompanies', 'people.subCompanies', 'organization.view', 'people.org']}><Organization /></EmployeePermissionRoute>} />
          <Route path="grades" element={<EmployeePermissionRoute module="hr" permissionKey={['people.org', 'people.departments']}><GradeManagement /></EmployeePermissionRoute>} />
          <Route path="approvals" element={<EmployeePermissionRoute module="hr" permissionKey="approval.view"><ApprovalsDashboard /></EmployeePermissionRoute>} />
        </Route>
        <Route element={<ProtectedModule module="attendance"><Outlet /></ProtectedModule>}>
          <Route path="management-attendance" element={<EmployeePermissionRoute module="attendance" permissionKey="attendance.dashboard"><AttendanceAdmin /></EmployeePermissionRoute>} />
        </Route>
        <Route element={<ProtectedModule module="recruitment"><Outlet /></ProtectedModule>}>
          <Route path="requirements" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.jobList"><RequirementPage /></EmployeePermissionRoute>} />
          <Route path="create-requirement" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.createReq"><CreateRequirement /></EmployeePermissionRoute>} />
          <Route path="position-master" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.positions"><PositionMaster /></EmployeePermissionRoute>} />
          <Route path="positions" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.positions"><PositionMaster /></EmployeePermissionRoute>} />
          <Route path="applicants" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.external"><Applicants /></EmployeePermissionRoute>} />
          <Route path="offers-joining" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.offersJoining"><OfferJoiningManager /></EmployeePermissionRoute>} />
          <Route path="job/:jobId/candidates" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.external"><Applicants jobSpecific={true} /></EmployeePermissionRoute>} />
          <Route path="internal-applicants" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.internal"><Applicants internalMode={true} /></EmployeePermissionRoute>} />
          <Route path="internal-applicants/job/:jobId/candidates" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.internal"><Applicants internalMode={true} jobSpecific={true} /></EmployeePermissionRoute>} />
          <Route path="candidate-status" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.tracker"><CandidateStatusTracker /></EmployeePermissionRoute>} />
          <Route path="candidate-status/:id" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.tracker"><CandidateTimeline /></EmployeePermissionRoute>} />
          <Route path="offer-templates" element={<EmployeePermissionRoute module="recruitment" permissionKey="hiring.offerTemplates"><LetterTemplates /></EmployeePermissionRoute>} />
          <Route path="career-builder" element={<CareerBuilder />} />
          <Route path="apply-builder" element={<ApplyPageBuilder />} />
        </Route>
        <Route element={<ProtectedModule module="payroll"><Outlet /></ProtectedModule>}>
          <Route path="payroll/dashboard" element={<EmployeePermissionRoute module="payroll" permissionKey="payroll.stats"><PayrollDashboard /></EmployeePermissionRoute>} />
          <Route path="payroll/salary-components" element={<EmployeePermissionRoute module="payroll" permissionKey="payroll.salary"><SalaryComponents /></EmployeePermissionRoute>} />
          <Route path="payroll/compensation" element={<EmployeePermissionRoute module="payroll" permissionKey="payroll.compensation"><Compensation /></EmployeePermissionRoute>} />
          <Route path="payroll/process" element={<EmployeePermissionRoute module="payroll" permissionKey="payroll.process"><ProcessPayroll /></EmployeePermissionRoute>} />
          <Route path="payroll/run" element={<EmployeePermissionRoute module="payroll" permissionKey="payroll.run"><RunPayroll /></EmployeePermissionRoute>} />
          <Route path="payroll/payslips" element={<EmployeePermissionRoute module="payroll" permissionKey="payroll.payslips"><Payslips /></EmployeePermissionRoute>} />
          <Route path="payslip-templates" element={<EmployeePermissionRoute module="payroll" permissionKey="payroll.payslips"><PayslipTemplates /></EmployeePermissionRoute>} />
        </Route>
        <Route element={<ProtectedModule module="onboarding"><Outlet /></ProtectedModule>}>
          <Route path="onboarding/dashboard" element={<EmployeePermissionRoute module="onboarding" permissionKey="onboarding.dashboard"><OnboardingDashboard /></EmployeePermissionRoute>} />
        </Route>
        <Route element={<ProtectedModule module="backgroundVerification"><Outlet /></ProtectedModule>}>
          <Route path="bgv" element={<EmployeePermissionRoute module="backgroundVerification" permissionKey="bgv.caseMaster"><BGVManagement /></EmployeePermissionRoute>} />
          <Route path="bgv/emails" element={<EmployeePermissionRoute module="backgroundVerification" permissionKey="bgv.emailLogs"><BGVEmailManagement /></EmployeePermissionRoute>} />
        </Route>
        <Route
          path="internal-jobs"
          element={
            <RBACRoute module="employee.jobs">
              <InternalJobs />
            </RBACRoute>
          }
        />
        <Route path="exit" element={<EmployeePermissionRoute permissionKey="employee.exit"><EmployeeExit /></EmployeePermissionRoute>} />
        <Route path="resignation" element={<EmployeePermissionRoute permissionKey="employee.exit"><EmployeeExit /></EmployeePermissionRoute>} />
        <Route path="manpower-requisition" element={<EmployeePermissionRoute permissionKey="employee.manpowerRequisition"><ManpowerRequisitionList /></EmployeePermissionRoute>} />
        <Route path="manpower-requisition/:id" element={<EmployeePermissionRoute permissionKey="employee.manpowerRequisition"><ManpowerRequisitionForm /></EmployeePermissionRoute>} />
        <Route path="manpower_requisition" element={<Navigate to="../manpower-requisition" replace />} />
        <Route
          path="payslips"
          element={
            <RBACRoute module="employee.payslips">
              <ESSPayslips />
            </RBACRoute>
          }
        />
        <Route
          path="my-documents"
          element={
            <RBACRoute module="employee.documents">
              <MyDocuments />
            </RBACRoute>
          }
        />
        <Route path="support-center" element={<EmployeePermissionRoute permissionKey="employee.tickets"><MyTickets /></EmployeePermissionRoute>} />
        <Route path="tickets" element={<EmployeePermissionRoute module="employeePortal" permissionKey="support.tickets"><SupportAdmin /></EmployeePermissionRoute>} />
        <Route path="onboarding" element={<EmployeePermissionRoute module="onboarding" permissionKey="onboarding.employeePortal"><EmployeeOnboardingForm /></EmployeePermissionRoute>} />
        <Route path="onboarding/profile" element={<EmployeePermissionRoute module="onboarding" permissionKey="onboarding.employeePortal"><EmployeeOnboardingForm /></EmployeePermissionRoute>} />
        <Route path="details/:entityType/:entityId" element={<EntityDetail />} />
        <Route path="settings/company" element={<EmployeePermissionRoute module="hr" permissionKey="configuration.company"><SmartSettingsRoute forceTab="company" /></EmployeePermissionRoute>} />
        <Route path="settings/social-media" element={<EmployeePermissionRoute module="socialMediaIntegration" permissionKey="socialMedia.dashboard"><SocialMediaPage /></EmployeePermissionRoute>} />
        <Route path="settings/social-media/accounts" element={<EmployeePermissionRoute module="socialMediaIntegration" permissionKey="socialMedia.accounts"><SocialMediaPage /></EmployeePermissionRoute>} />
        <Route path="settings/social-media/create" element={<EmployeePermissionRoute module="socialMediaIntegration" permissionKey="socialMedia.create"><SocialMediaPage /></EmployeePermissionRoute>} />
        <Route path="settings/social-media/history" element={<EmployeePermissionRoute module="socialMediaIntegration" permissionKey="socialMedia.history"><SocialMediaPage /></EmployeePermissionRoute>} />
        <Route path="settings/sequences" element={<EmployeePermissionRoute module="hr" permissionKey="configuration.sequences"><SmartSettingsRoute forceTab="sequences" /></EmployeePermissionRoute>} />
        <Route path="profile" element={<EmployeeProfileView />} />
        <Route path="my-requests" element={<MyRequests />} />
        <Route path="face-attendance" element={<FaceAttendance />} />
        <Route path="attendance-calendar" element={<RBACRoute module="attendance.calendar"><CalendarManagement /></RBACRoute>} />
        <Route path="face-update-requests" element={<RBACRoute module="attendance.face"><FaceUpdateRequests /></RBACRoute>} />
      </Route>

      <Route path="verify-company/:token" element={<VerifyCompany />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}
