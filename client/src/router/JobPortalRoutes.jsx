/**
 * JobPortalRoutes.jsx
 * COMPLETELY ISOLATED routing for Job Portal
 * NO connection to HRMS routes, layouts, or auth
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { JobPortalAuthProvider, useJobPortalAuth } from '../context/JobPortalAuthContext';

// Job Portal Components
import CandidateLogin from '../pages/Candidate/CandidateLogin';
import CandidateSignup from '../pages/Candidate/CandidateRegister';
import CandidateDashboard from '../pages/Candidate/CandidateDashboard';
import CandidateOpenPositions from '../pages/Candidate/CandidateOpenPositions';
import CandidateApplications from '../pages/Candidate/CandidateApplications';
import CandidateProfile from '../pages/Candidate/CandidateProfile';
import ApplicationTrack from '../pages/ApplicationTrack';
import JobApplication from '../pages/JobApplication/JobApplication';
import Jobs from '../pages/JobApplication/JobsList';
import NotFound from '../pages/NotFound';

// Job Portal Layout
import JobPortalLayout from '../layouts/JobPortalLayout';

class JobPortalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface route crashes without a blank page.
    console.error('[JobPortal] Route render crashed', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white p-6">
          <div className="w-full max-w-2xl rounded-2xl border border-rose-100 bg-rose-50 p-6 text-rose-800">
            <div className="text-sm font-black uppercase tracking-widest">Job Portal Error</div>
            <div className="mt-3 font-mono text-xs whitespace-pre-wrap break-words">
              {String(this.state.error?.message || this.state.error)}
            </div>
            <div className="mt-4 text-xs text-rose-700">
              Open browser console for full stack trace.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Job Portal Protected Route
 * Uses ONLY JobPortalAuthContext
 */
function JobPortalProtectedRoute({ children }) {
  const { candidate, isInitialized } = useJobPortalAuth();

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!candidate) {
    return <Navigate to="/candidate/login" replace />;
  }

  return children;
}

/**
 * Candidate Portal Routes (mounted at /candidate/*)
 */
function CandidatePortalRoutesContent() {
  return (
    <Routes>
      {/* Public */}
      <Route path="login" element={<CandidateLogin />} />
      <Route path="signup" element={<CandidateSignup />} />

      {/* Protected Candidate Routes (Dashboard Shell) */}
      <Route
        path=""
        element={
          <JobPortalProtectedRoute>
            <JobPortalLayout />
          </JobPortalProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CandidateDashboard />} />
        <Route path="open-positions" element={<CandidateOpenPositions />} />
        <Route path="applications" element={<CandidateApplications />} />
        <Route path="profile" element={<CandidateProfile />} />
      </Route>

      <Route
        path="application/:applicationId"
        element={
          <JobPortalProtectedRoute>
            <ApplicationTrack />
          </JobPortalProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}

function CandidatePortalRoutes() {
  return (
    <JobPortalAuthProvider>
      <JobPortalErrorBoundary>
        <CandidatePortalRoutesContent />
      </JobPortalErrorBoundary>
    </JobPortalAuthProvider>
  );
}

/**
 * Jobs listing (mounted at /jobs/* only)
 * NOTE: Do not mount together with apply-job using the same ":id" pattern — React Router
 * matches the first route; /apply-job/:requirementId was incorrectly rendering JobsList.
 */
function JobsPortalRoutesContent() {
  return (
    <Routes>
      <Route path=":companyId" element={<Jobs />} />
      <Route path="" element={<div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2 font-sans">Job Portal</h2>
          <p className="text-slate-500 font-sans">Please use a specific company link to view open positions.</p>
        </div>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function JobsPortalRoutes() {
  return (
    <JobPortalAuthProvider>
      <JobPortalErrorBoundary>
        <JobsPortalRoutesContent />
      </JobPortalErrorBoundary>
    </JobPortalAuthProvider>
  );
}

/**
 * Public job application form (mounted at /apply-job/* only)
 */
function ApplyJobPortalRoutesContent() {
  return (
    <Routes>
      <Route path=":requirementId" element={<JobApplication />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function ApplyJobPortalRoutes() {
  return (
    <JobPortalAuthProvider>
      <JobPortalErrorBoundary>
        <ApplyJobPortalRoutesContent />
      </JobPortalErrorBoundary>
    </JobPortalAuthProvider>
  );
}

export const JobPortalCandidateRoutes = CandidatePortalRoutes;
export const JobPortalJobsRoutes = JobsPortalRoutes;
export const JobPortalApplyRoutes = ApplyJobPortalRoutes;
