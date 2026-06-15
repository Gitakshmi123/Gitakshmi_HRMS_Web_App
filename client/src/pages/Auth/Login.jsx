import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUnified, user, isInitialized, isLoading } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!isInitialized || !user) return;

    const roleName = String(user?.roleName || user?.role || '').toLowerCase();
    const from = location.state?.from?.pathname || null;

    if (from) {
      navigate(from, { replace: true });
      return;
    }

    if (['psa', 'super_admin', 'superadmin'].includes(roleName)) {
      navigate('/super-admin/dashboard', { replace: true });
    } else if (['hr', 'admin', 'company_super_admin', 'company_admin', 'sub_company_admin', 'branch_head', 'division_head', 'department_head', 'designation_head'].includes(roleName)) {
      navigate('/hr', { replace: true });
    } else {
      navigate('/employee/dashboard', { replace: true });
    }
  }, [isInitialized, user, navigate, location.state, location]);

  async function handleLogin(e) {
    e.preventDefault();
    if (isLoading) return;
    setError("");
    setIsSubmitting(true);

    try {
      const res = await loginUnified(identifier.trim(), password, null);
      if (res.success) {
        // Redirection is handled by the useEffect above once the auth state updates,
        // but the loginUnified also does a window.location.href = '/' which reloads.
        return;
      }
      if (res.message === "identifier_and_password_required") {
        setError("Please enter email/employee code and password");
      } else if (res.message === "invalid_credentials") {
        setError("Invalid credentials. Please check and try again.");
      } else {
        setError(res.message || "Login failed");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isPageLoading = isSubmitting || isLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="relative w-full max-w-md mx-auto">
        <div className="absolute -left-20 -top-16 w-72 h-72 bg-indigo-100 rounded-full blur-3xl opacity-40" />
        <div className="absolute -right-16 -bottom-20 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-40" />
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="p-10 w-full">
            <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">HRMS Login</h2>

            {error && (
              <div className="p-3 mb-4 bg-red-50 text-red-700 text-sm rounded border border-red-100 text-center transform transition-all duration-300 scale-100">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 ml-1">Email or Employee Code</label>
                <input
                  type="text"
                  className="w-full mt-1 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none shadow-sm transition-all duration-200"
                  placeholder="name@company.com or EMP001"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 ml-1">Password</label>
                <input
                  type="password"
                  className="w-full mt-1 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none shadow-sm transition-all duration-200"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-indigo-100 font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
