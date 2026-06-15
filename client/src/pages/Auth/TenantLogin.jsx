import React, { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import gitakshmiTechnologiesLogo from "../../assets/gitakshmi-technologies-logo.png";

export default function TenantLogin() {
  const navigate = useNavigate();
  const { loginUnified, user, isInitialized, isLoading, getRouteByRole } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!isInitialized || !user) return;
    const target = getRouteByRole(user.roleName || user.role);
    navigate(target, { replace: true });
  }, [isInitialized, navigate, user, getRouteByRole]);

  const FRIENDLY_ERRORS = useMemo(
    () => ({
      invalid_credentials: "Invalid email or password.",
      invalid_email: "Invalid email or password.",
      invalid_password: "Invalid email or password.",
      tenant_not_found: "Account not found.",
      account_suspended: "This account has been suspended.",
      account_deactivated: "This account has been deactivated. Please contact support.",
      identifier_and_password_required: "Please enter email/employee ID and password.",
      endpoint_not_found: "Authentication service is currently unavailable.",
      server_error: "Authentication service is currently unavailable.",
    }),
    []
  );

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    setIsSubmitting(true);
    try {
      const result = await loginUnified(email.trim(), password, null);
      if (result?.success && result?.user) {
        const roleName =
          result.user.roleName ||
          (typeof result.user.role === "object" ? result.user.role?.name : result.user.role);
        navigate(getRouteByRole(roleName), { replace: true });
        return;
      }

      const message = result?.message || "invalid_credentials";
      setError(FRIENDLY_ERRORS[message] || message || "Unable to sign in.");
    } catch {
      setError("Authentication service is currently unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isLoading || isSubmitting;

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
              <h2 className="mt-2 text-3xl font-bold text-[#0F172A]">Welcome back</h2>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex gap-2 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email or Emp ID</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com or EMP-001"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-[#DDE5F0] pl-11 pr-4 text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 font-medium"
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
                    className="h-12 w-full rounded-xl border border-slate-200 bg-[#DDE5F0] pl-11 pr-12 text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 font-medium"
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

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="h-12 w-full rounded-lg bg-[#0B1734] text-sm font-bold text-white shadow-[0_10px_25px_rgba(11,23,52,0.25)] transition hover:bg-[#0A1430] disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2 tracking-wide uppercase"
                >
                  {isBusy ? "Logging in..." : "Login"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
