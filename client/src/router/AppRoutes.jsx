import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buildSsoLoginRedirectUrl } from "../utils/api";
import { USE_SSO_ONLY_AUTH } from "../utils/appConfig";
import TenantLogin from "../pages/Auth/TenantLogin";

import TenantDashboard from "../pages/HR/HRDashboard";
import EmployeeDashboard from "../pages/Employee/EmployeeDashboard";

const InvalidRouteLogout = () => {
  const { logout } = useAuth();
  
  useEffect(() => {
    logout();
  }, [logout]);
  
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6", color: "#64748B", fontFamily: "sans-serif", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
      <p>Logging out due to invalid access...</p>
    </div>
  );
};

const PreserveSearchRedirect = ({ to }) => {
  const location = useLocation();
  return <Navigate to={`${to}${location.search || ""}`} replace />;
};

const AuthErrorPage = () => {
  const { authError } = useAuth();

  return (
    <div style={{ padding: "50px", textAlign: "center" }}>
      <h2>Authentication Error</h2>
      <p>{authError || "Unable to complete SSO authentication."}</p>
      <button
        type="button"
        onClick={() => window.location.replace(buildSsoLoginRedirectUrl(`${window.location.origin}/tenant/dashboard`))}
        style={{ marginTop: 16, padding: "10px 16px", cursor: "pointer" }}
      >
        {USE_SSO_ONLY_AUTH ? "Go To SSO Login" : "Back To Login"}
      </button>
    </div>
  );
};

const SSORedirectPage = () => {
  const { user, authLoading, getRouteByRole, authError, isInitialized } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const hasToken = params.has("token");

  // While checking auth or initializing, show nothing or a loader
  if (authLoading || !isInitialized) return null;

  // If we have an error, show the error page instead of redirecting again
  if (authError) {
    return <Navigate to="/auth-error" replace />;
  }

  if (!USE_SSO_ONLY_AUTH) {
    return <Navigate to="/login" replace />;
  }

  // If already authenticated, go to dashboard
  if (user) {
    return <Navigate to={getRouteByRole(user.role)} replace />;
  }

  // If we JUST received a token in the URL, wait. 
  // AuthProvider's useEffect should trigger checkAuth which will consume the token.
  if (hasToken) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h2>Authenticating...</h2>
        <p>Completing Single Sign-On handshake.</p>
      </div>
    );
  }

  // No user, no token, no error -> Redirect to SSO
  // Ensure we don't redirect back to /login to avoid loops
  const currentUrl = `${window.location.origin}/tenant/dashboard`;
  const finalSsoUrl = buildSsoLoginRedirectUrl(currentUrl);

  window.location.replace(finalSsoUrl);
  return null;
};

function AutoHome() {
  const { user, authLoading, getRouteByRole, authError } = useAuth();

  if (authLoading) return null;
  if (!user) return <Navigate to={authError ? "/auth-error" : "/login"} replace />;

  return <Navigate to={getRouteByRole(user.role)} replace />;
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, authLoading, authError } = useAuth();

  if (authLoading) return null;
  if (!user) return <Navigate to={authError ? "/auth-error" : "/login"} replace />;

  const role = String(user?.role || "").toLowerCase();
  const allowed = allowedRoles.map((r) => String(r || "").toLowerCase());

  if (!allowed.includes(role)) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
};

const TenantIndexRedirect = () => {
  const { user, authLoading, getRouteByRole } = useAuth();
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getRouteByRole(user.role)} replace />;
};

export default function AppRoutes() {
  const loginElement = USE_SSO_ONLY_AUTH ? <SSORedirectPage /> : <TenantLogin />;

  return (
    <Routes>
      <Route path="/" element={<AutoHome />} />
      <Route path="/login" element={loginElement} />
      <Route path="/access-denied" element={<InvalidRouteLogout />} />
      <Route path="/auth-error" element={<AuthErrorPage />} />

      <Route path="/tenant" element={<TenantIndexRedirect />} />
      <Route path="/tenant/admin-dashboard" element={<PreserveSearchRedirect to="/tenant/dashboard" />} />
      <Route path="/super-admin/dashboard" element={<Navigate to="/tenant/dashboard" replace />} />

      <Route
        path="/tenant/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin", "hr", "company_admin", "super_admin", "psa", "superadmin", "owner", "company", "manager"]}>
            <TenantDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employee/dashboard"
        element={
          <ProtectedRoute allowedRoles={["employee", "manager", "user", "staff"]}>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<InvalidRouteLogout />} />
    </Routes>
  );
}
