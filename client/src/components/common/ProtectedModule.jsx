import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRBAC } from '../../context/RBACContext';
import { isPrivilegedManagementRole } from '../../utils/employeeAccess';

const MODULE_PERMISSION_PROBES = {
    hr: ['overview.dashboard', 'configuration.access', 'people.employees', 'configuration.company', 'company.subCompanies', 'leave.requests', 'leave.policies', 'leave.custom', 'approval.view'],
    attendance: ['attendance.dashboard', 'attendance.calendar', 'attendance.face'],
    leave: ['leave.requests', 'leave.policies'],
    payroll: ['payroll.stats', 'payroll.salary', 'payroll.payslips', 'payroll.process'],
    recruitment: ['hiring.jobList', 'hiring.createReq', 'hiring.internal', 'hiring.external', 'hiring.offersJoining'],
    support: ['support.tickets'],
    onboarding: ['onboarding.dashboard', 'onboarding.employeePortal'],
    backgroundVerification: ['bgv.caseMaster', 'bgv.emailLogs'],
    documentManagement: ['documents.dashboard', 'documents.templates', 'documents.settings'],
    employeePortal: ['employee.dashboard', 'employee.attendance', 'employee.payslips', 'employee.documents', 'employee.jobs', 'employee.tickets', 'employee.exit'],
    reports: ['reports.staffing', 'reports.movements', 'reports.trends', 'reports.performance'],
    policy: ['policy.view', 'policy.manage'],
};

/**
 * A wrapper component to protect routes based on enabled modules.
 * If the module is not enabled, it redirects to /unauthorized.
 * Super Admin (role: 'psa') bypasses this check.
 * 
 * @param {string} module - The name of the module to check (e.g., 'hr', 'payroll')
 * @param {string} permissionKey - Optional RBAC page key (e.g. 'people.employees')
 * @param {string} action - Optional RBAC action for permissionKey
 * @param {React.ReactNode} children - The components to render if allowed
 */
const ProtectedModule = ({ module, permissionKey = null, action = 'view', children }) => {
    const { user, enabledModules, loading: authLoading } = useAuth();
    const { hasPermission, loading, permissions } = useRBAC();
    const location = useLocation();
    
    const getRoleName = (user) => {
        return String(
            user?.roleName || 
            (user?.role && typeof user.role === 'object' ? user.role.name : user?.role) || 
            ''
        ).toLowerCase();
    };

    const roleName = getRoleName(user);

    const isPsa = ['psa', 'super_admin'].includes(roleName);

    if (isPsa) {
        return <>{children}</>;
    }

    // While auth is still loading or modules haven't been fetched yet, wait silently.
    // This prevents a race condition where stale/empty localStorage cache causes
    // premature Unauthorized redirects before the server returns fresh module data.
    if (authLoading || enabledModules === null || enabledModules === undefined) {
        return null;
    }

    // Check if module is enabled
    let targetModule = module;
    if (module === 'documentManagement' || module === 'documents') targetModule = 'documentManagement';
    else if (module === 'backgroundVerification' || module === 'bgv') targetModule = 'backgroundVerification';
    else if (module === 'leave' && enabledModules?.['policy']) targetModule = 'policy';
    else if (module === 'policy' && enabledModules?.['leave']) targetModule = 'leave';

    const normalizedModule = enabledModules?.[targetModule] || enabledModules?.[module];
    const isEnabled = enabledModules && (normalizedModule === true || normalizedModule === 'true');
    const probeKeys = MODULE_PERMISSION_PROBES[targetModule] || MODULE_PERMISSION_PROBES[module] || [];
    const hasModulePermission = probeKeys.some((key) => hasPermission(key, 'any'));

    if (loading && !permissions) return null;

    const isPrivileged = !!user && isPrivilegedManagementRole(roleName);
    const isPermitted = permissionKey ? hasPermission(permissionKey, action) : true;

    if (!isEnabled || (!isPrivileged && !hasModulePermission && probeKeys.length > 0) || !isPermitted) {
        console.warn(`[ProtectedModule] Access denied for module: ${module}. Redirecting to safe landing.`);
        // Redirect to safe landing instead of showing error page
        const safeLanding = isPrivileged ? '/hr/dashboard' : '/employee/dashboard';
        if (location.pathname === safeLanding) {
            return <Navigate to="/unauthorized" replace />;
        }
        return <Navigate to={safeLanding} replace />;
    }

    return <>{children}</>;
};

export default ProtectedModule;

