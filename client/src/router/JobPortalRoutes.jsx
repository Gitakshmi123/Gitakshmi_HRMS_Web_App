/**
 * JobPortalRoutes.jsx
 * COMPLETELY ISOLATED routing for Job Portal
 * NO connection to HRMS routes, layouts, or auth
 */
import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { JobPortalAuthProvider, useJobPortalAuth } from '../context/JobPortalAuthContext';
import EmployeeForm from '../pages/HR/EmployeeForm';

// Job Portal Components
import CandidateLogin from '../pages/Candidate/CandidateLogin';
import CandidateSignup from '../pages/Candidate/CandidateRegister';
import CandidateDashboard from '../pages/Candidate/CandidateDashboard';
import CandidateOpenPositions from '../pages/Candidate/CandidateOpenPositions';
import CandidateApplications from '../pages/Candidate/CandidateApplications';
import CandidateProfile from '../pages/Candidate/CandidateProfile';
import CandidateDocumentRedirect from '../pages/Candidate/CandidateDocumentRedirect';
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

import api from '../utils/api';

function CandidateDocumentUploadWrapper() {
  const { token } = useParams();
  const [employeeData, setEmployeeData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const fetchDraft = async () => {
      try {
        const res = await api.get(`/public/candidate-documents/token/${token}`);
        const r = res.data?.data?.record || {};
        
        // Map nested ExternalEmployeeRecord back to Employee flat structure for the form
        const mappedEmployee = {
          ...r.personalDetails,
          spouseDetails: r.familyDetails?.spouseDetails || {},
          children: r.familyDetails?.children || [],
          brothers: r.familyDetails?.brothers || [],
          sisters: r.familyDetails?.sisters || [],
          tempAddress: r.communicationDetails?.tempAddress || {},
          permAddress: r.communicationDetails?.permAddress || {},
          commAddress: r.communicationDetails?.commAddress || r.communicationDetails || {},
          education: r.educationDetails?.education || {},
          academicQualifications: r.educationDetails?.academicQualifications || [],
          experience: r.experienceDetails?.experience || [],
          jobHistoryAnnexure: r.experienceDetails?.jobHistoryAnnexure || [],
          bankDetails: r.bankDetails || {},
          documents: r.documentDetails || {},
          status: r.status,
          _id: r._id,
        };
        
        setEmployeeData(mappedEmployee);
      } catch (err) {
        console.error(err);
        setError('Invalid or expired document request link.');
      } finally {
        setLoading(false);
      }
    };
    fetchDraft();
  }, [token]);

  if (loading) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Document Portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center max-w-lg shadow-lg">
          <h3 className="text-2xl font-bold text-rose-600 mb-2">Access Denied</h3>
          <p className="text-slate-500 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pt-6 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <EmployeeForm employee={employeeData} isExternal={true} token={token} />
      </div>
    </div>
  );
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
      <Route path="document-upload/:token" element={<CandidateDocumentUploadWrapper />} />

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
        <Route path="upload-documents" element={<CandidateDocumentRedirect />} />
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
