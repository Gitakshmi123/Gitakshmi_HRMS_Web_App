import React from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { user, isInitialized, authLoading, authError, getLocalLoginRoute } = useAuth();
  const location = useLocation();

  if (!isInitialized || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      </div>
    );
  }

  if (!user) {
    if (authError) {
      return <Navigate to="/auth-error" replace />;
    }
    return <Navigate to={getLocalLoginRoute()} state={{ from: location }} replace />;
  }

  return children;
}
