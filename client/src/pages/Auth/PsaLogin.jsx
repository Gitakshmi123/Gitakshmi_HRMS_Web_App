import React, { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function PsaLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginHR, user, isInitialized, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isInitialized || !user) return;

    const roleName = (user?.roleName || user?.role || "").toLowerCase();
    if (roleName === "psa" || roleName === "super_admin") {
      navigate("/psa", { replace: true });
    }
  }, [isInitialized, navigate, user]);

  const FRIENDLY_ERRORS = useMemo(
    () => ({
      invalid_credentials: "Invalid Super Admin credentials.",
      endpoint_not_found: "Authentication service is currently unavailable.",
    }),
    []
  );

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    try {
      // PSA doesn't need a company code
      const result = await loginHR("", email.trim(), password);

      if (result?.success) {
        navigate("/psa", { replace: true });
        return;
      }

      setError(FRIENDLY_ERRORS[result?.message] || "Invalid credentials. Please try again.");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#0F172A] font-['Inter']">
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-2">
        {/* Left Side - PSA Branding */}
        <section className="relative hidden h-full border-r border-slate-800 bg-[#1E293B] lg:flex lg:items-center lg:justify-center">
          <div className="flex flex-col items-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.3)]">
              <ShieldCheck className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Gitakshmi PSA</h1>
            <p className="mt-2 text-slate-400">Product Super Admin Control Center</p>
          </div>
        </section>

        {/* Right Side - Login Form */}
        <section className="flex h-full items-center justify-center bg-[#0F172A] px-6 py-6 lg:px-10">
          <div className="w-full max-w-[460px] rounded-2xl border border-slate-800 bg-[#1E293B] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] md:p-10">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                </span>
                Secure Access
              </div>
              <h2 className="mt-4 text-3xl font-bold text-white">System Login</h2>
              <p className="mt-2 text-base text-slate-400">Enter your administrative credentials</p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400 flex gap-2 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Admin Email</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="superadmin@hrms.com"
                    className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900/50 pl-11 pr-4 text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium"
                    disabled={isLoading}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Password</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900/50 pl-11 pr-12 text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 w-full rounded-lg bg-blue-600 text-sm font-bold text-white shadow-[0_10px_25px_rgba(37,99,235,0.3)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2 tracking-wide"
                >
                  {isLoading ? "Verifying..." : "Access Control Panel ->"}
                </button>
              </div>

              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-sm font-medium text-slate-400 transition hover:text-white"
                >
                  Back to Client Login
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
