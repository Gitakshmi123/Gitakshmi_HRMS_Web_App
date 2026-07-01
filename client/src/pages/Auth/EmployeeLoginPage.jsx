import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail, Building2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import gitakshmiTechnologiesLogo from "../../assets/gitakshmi-technologies-logo.png";

export default function EmployeeLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginEmployee, user, isInitialized, isLoading } = useAuth();
  const didAutoRedirect = useRef(false);

  const [companyCode, setCompanyCode] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isInitialized) return;
    if (didAutoRedirect.current) return;

    const roleName = (user?.roleName || user?.role || "").toLowerCase();
    const onEmployeeLoginRoute = location.pathname.toLowerCase().includes("/employee/login");

    if (onEmployeeLoginRoute && ["employee", "manager"].includes(roleName)) {
      didAutoRedirect.current = true;
      navigate("/employee", { replace: true });
    }
  }, [isInitialized, navigate, user, location.pathname]);

  const FRIENDLY_ERRORS = useMemo(
    () => ({
      account_deactivated: "Your account has been deactivated. Please contact HR for assistance.",
      invalid_credentials: "Invalid credentials. Please check your Company Code, ID and password.",
      employee_not_found: "Account not found.",
      endpoint_not_found: "Authentication service is currently unavailable.",
      sso_only: "Direct login is disabled. Please login via GT ONE.",
    }),
    []
  );

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    const trimmedIdentifier = identifier.trim();
    const trimmedCompanyCode = companyCode.trim();

    try {
      const result = await loginEmployee(trimmedCompanyCode, trimmedIdentifier, password);

      if (result?.success) {
        navigate("/employee", { replace: true });
        return;
      }

      setError(FRIENDLY_ERRORS[result?.message] || "Invalid credentials. Please try again.");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#F3F4F6] font-['Inter']">
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-2">
        {/* Left Side - Logo and Branding */}
        <section className="relative hidden h-full border-r border-slate-200 bg-white lg:flex lg:items-center lg:justify-center">
          <div className="flex flex-col items-center">
            <img
              src={gitakshmiTechnologiesLogo}
              alt="Gitakshmi Technologies logo"
              className="h-44 w-auto max-w-[560px] object-contain"
            />
          </div>
        </section>

        {/* Right Side - Login Form */}
        <section className="flex h-full items-center justify-center bg-[#F3F4F6] px-6 py-6 lg:px-10">
          <div className="w-full max-w-[500px] rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.14)] md:p-10">
            <div className="mb-8">
              <p className="text-xs font-semibold text-[#2563EB] tracking-wider uppercase">Employee Access</p>
              <h2 className="mt-2 text-3xl font-bold text-[#0F172A]">Welcome</h2>
              <p className="mt-2 text-base text-slate-500">Sign in to your account to continue</p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex gap-2 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Company Code</span>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    placeholder="e.g. git001"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-[#DDE5F0] pl-11 pr-4 text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 disabled:opacity-50 font-medium"
                    disabled={isLoading}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email or Emp ID</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="email@example.com or EMP-00124"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-[#DDE5F0] pl-11 pr-4 text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 disabled:opacity-50 font-medium"
                    disabled={isLoading}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Password</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-[#DDE5F0] pl-11 pr-12 text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 disabled:opacity-50 font-medium"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 w-full rounded-lg bg-[#0B1734] text-sm font-bold text-white shadow-[0_10px_25px_rgba(11,23,52,0.25)] transition hover:bg-[#0A1430] disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2 tracking-wide"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Signing In...
                    </>
                  ) : "Sign In ->"}
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem("tenant_nav_intent", "1");
                    navigate("/tenant/login");
                  }}
                  className="text-sm font-semibold text-[#2563EB] transition hover:text-[#1D4ED8] hover:underline"
                >
                  Login as Tenant
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
