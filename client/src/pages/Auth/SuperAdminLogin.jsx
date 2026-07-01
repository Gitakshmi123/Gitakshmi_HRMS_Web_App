import React, { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const { login, user, isInitialized, isLoading } = useAuth();

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
      invalid_credentials: "Invalid email or password.",
      endpoint_not_found: "Authentication service is currently unavailable. Please try again.",
    }),
    []
  );

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const result = await login(email.trim(), password);

      if (result?.success) {
        navigate("/psa", { replace: true });
        return;
      }

      setError(FRIENDLY_ERRORS[result?.message] || result?.message || "Login failed");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#F3F4F6] font-['Inter']">
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-2">
        <section className="relative hidden h-full border-r border-[#cfd7e3] bg-[#DCE3EE] lg:flex lg:items-center lg:justify-center">
          <div className="flex flex-col items-center">
            <img
              src="https://gitakshmi.com/wp-content/themes/geetaxmiwp-child/images/logo.png"
              alt="GitakshmiHR logo"
              className="h-24 w-auto object-contain"
            />
          </div>
        </section>

        <section className="flex h-full items-center justify-center bg-[#F3F4F6] px-6 py-6 lg:px-10">
          <div className="w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.14)] md:p-8">
            <div className="mb-6">
              <p className="text-xs font-medium text-[#2563EB]">Super Admin Access</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#0F172A]">Welcome</h2>
              <p className="mt-2 text-lg text-slate-500">Sign in to your account to continue</p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@platform.com"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-[#DDE5F0] pl-11 pr-4 text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Password</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-[#DDE5F0] pl-11 pr-12 text-slate-800 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
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

              <button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full rounded-lg bg-[#0B1734] text-sm font-semibold text-white shadow-[0_10px_25px_rgba(11,23,52,0.25)] transition hover:bg-[#0A1430] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Signing In..." : "Sign In ->"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
