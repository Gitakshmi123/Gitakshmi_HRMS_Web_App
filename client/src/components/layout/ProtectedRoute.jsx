import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRBAC } from '../../context/RBACContext';
import Loader from '../common/Loader';
import {
  isEmployeeLikeRole,
  isPrivilegedManagementRole,
  resolveFirstAllowedEmployeePath,
} from '../../utils/employeeAccess';

const ADMIN_ROLES = [
  'hr',
  'admin',
  'company_super_admin',
  'company_admin',
  'human_resource',
  'hr manager',
  'hr_manager',
  'hr_admin',
  'super_admin',
  'psa',
  'company administrator',
  'hr-manager',
  'company-admin',
];

const getRoleName = (user) =>
  String(
    user?.roleName ||
      (user?.role && typeof user.role === 'object' ? user.role.name : user?.role) ||
      'employee'
  ).toLowerCase();

export default function ProtectedRoute({ children, allowedRoles, module, action = 'view' }) {
  const { user, isInitialized, authLoading, getLocalLoginRoute, accessDenied, authError } = useAuth();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const location = useLocation();

  if (!isInitialized || authLoading) {
    return <Loader fullPage={true} text="Verifying session..." />;
  }

  const hasValidSession = !!user;

  if (accessDenied) {
    return <Navigate to="/access-denied" replace />;
  }

  if (!hasValidSession) {
    if (authError) return <Navigate to="/auth-error" replace />;
    const loginRoute = getLocalLoginRoute();
    if (location.pathname.toLowerCase() === loginRoute.toLowerCase()) return children;
    return <Navigate to={loginRoute} state={{ from: location }} replace />;
  }

  const roleName = getRoleName(user);
  const isAdmin = ADMIN_ROLES.includes(roleName) || isPrivilegedManagementRole(roleName);

  if (allowedRoles?.length) {
    const normalizedAllowed = allowedRoles.map((r) => String(r || '').toLowerCase());
    const hasAllowedRole =
      normalizedAllowed.includes(roleName) ||
      (isAdmin && normalizedAllowed.some((role) => isPrivilegedManagementRole(role)));

    if (!hasAllowedRole) {
      const isEmployeeLike = isEmployeeLikeRole(roleName);
      if (isEmployeeLike) {
        if (rbacLoading && !hasPermission) return <Loader fullPage={true} text="Synchronizing permissions..." />;

        const targetPath = location.pathname.toLowerCase();
        const isManagementRoute = targetPath.startsWith('/tenant/') || targetPath.startsWith('/hr/');
        const employeeLandingPath = resolveFirstAllowedEmployeePath(hasPermission);

        if (isManagementRoute) {
          const translatedPath = targetPath.replace(/^\/(tenant|hr)(?=\/|$)/, '/employee') || '/employee';
          return <Navigate to={translatedPath === '/employee' ? (employeeLandingPath || '/unauthorized') : translatedPath} replace />;
        }

        return <Navigate to={employeeLandingPath || '/unauthorized'} replace />;
      }

      return <Navigate to="/unauthorized" replace />;
    }
  }

  if (module) {
    if (rbacLoading && !hasPermission) return <Loader fullPage={true} text="Verifying module access..." />;
    if (!hasPermission(module, action)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
}
