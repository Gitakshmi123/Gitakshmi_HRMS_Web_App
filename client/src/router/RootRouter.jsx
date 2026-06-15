/**
 * RootRouter.jsx
 * Master router that separates HRMS and Job Portal systems.
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import HrmsRoutes from './HrmsRoutes';
import { JobPortalCandidateRoutes, JobPortalJobsRoutes, JobPortalApplyRoutes } from './JobPortalRoutes';
import PublicCareerPage from '../pages/PublicCareerPage';
import EmployeeOnboardingPortal from '../pages/Onboarding/EmployeeOnboardingPortal';
import OfferApprovalPortal from '../pages/Public/OfferApprovalPortal';
import NotFound from '../pages/NotFound';
import Loader from '../components/common/Loader';

// Auth Pages
import TenantLogin from '../pages/Auth/TenantLogin';
import { AccessDeniedPage, AuthErrorPage, UnauthorizedPage } from '../pages/Auth/AuthStatusPages';

/**
 * Root home redirect
 */
function RootHome() {
  const { user, isInitialized, getRouteByRole, getLocalLoginRoute } = useAuth();

  if (!isInitialized) {
    return <Loader fullPage={true} text="Checking Session" />;
  }

  if (user) {
    const target = getRouteByRole(user.roleName || user.role);
    return <Navigate to={target} replace />;
  }

  return <Navigate to={getLocalLoginRoute ? getLocalLoginRoute() : '/login'} replace />;
}

/**
 * Main Root Router
 */
export default function RootRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootHome />} />

      {/* Job Portal System */}
      <Route path="/jobs/*" element={<JobPortalJobsRoutes />} />
      <Route path="/candidate/*" element={<JobPortalCandidateRoutes />} />
      <Route path="/apply-job/*" element={<JobPortalApplyRoutes />} />

      {/* Public Career Page */}
      <Route path="/careers/:tenantId" element={<PublicCareerPage />} />

      {/* Public Offer Approval Page */}
      <Route path="/public/offer-approval/:token" element={<OfferApprovalPortal />} />

      {/* Onboarding */}
      <Route path="/onboarding/:token" element={<EmployeeOnboardingPortal />} />
      <Route path="/onboarding" element={<EmployeeOnboardingPortal />} />

      {/* PUBLIC AUTH ROUTES */}
      <Route path="/login" element={<TenantLogin />} />
      <Route path="/tenant/login" element={<Navigate to="/login" replace />} />
      <Route path="/psa/login" element={<Navigate to="/login" replace />} />
      <Route path="/login/psa" element={<Navigate to="/login" replace />} />
      <Route path="/login/hr" element={<Navigate to="/login" replace />} />
      <Route path="/login/employee" element={<Navigate to="/login" replace />} />
      <Route path="/employee/login" element={<Navigate to="/login" replace />} />
      <Route path="/sso-redirect" element={<Navigate to="/login" replace />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route path="/auth-error" element={<AuthErrorPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* HRMS System */}
      <Route path="/*" element={<HrmsRoutes />} />

      {/* Catch-all 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
