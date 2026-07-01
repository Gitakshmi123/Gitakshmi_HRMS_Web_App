import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import api, { resolveTenantLogoUrl } from '../../utils/api';
import { setCandidateCompany, getCandidateCompany } from '../../utils/auth';
import { companyMatchesPortalIdentifier, getJobPortalIdentifier } from '../../utils/jobPortalContext';
import { ArrowLeft, ArrowRight, Briefcase, Lock, Mail, ShieldCheck, CheckCircle2, KeyRound } from 'lucide-react';
import Loader from '../../components/common/Loader';

export default function CandidateLogin() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loginCandidate, candidate, isInitialized } = useJobPortalAuth();

    const portalIdentifier = getJobPortalIdentifier(searchParams);
    const redirectPath = searchParams.get('redirect');
    const [company, setLocalCompany] = useState({ name: 'Careers', code: '' });
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [logoUrl, setLogoUrl] = useState(() => {
        const stored = getCandidateCompany();
        return stored ? resolveTenantLogoUrl(stored) : null;
    });

    // Forgot Password State
    const [isForgotMode, setIsForgotMode] = useState(false);
    const [forgotStep, setForgotStep] = useState(1);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState('');
    const [forgotDebugOtp, setForgotDebugOtp] = useState('');

    useEffect(() => {
        if (!isInitialized) return;
        if (!candidate) return;
        const target = redirectPath && redirectPath.startsWith('/') ? redirectPath : '/candidate/dashboard';
        navigate(target, { replace: true });
    }, [candidate, isInitialized, navigate, redirectPath]);

    useEffect(() => {
        let isMounted = true;
        async function fetchCompany() {
            if (!portalIdentifier) {
                setPageLoading(false);
                return;
            }

            setPageLoading(true);
            try {
                let companyInfo = getCandidateCompany();

                if (!companyMatchesPortalIdentifier(companyInfo, portalIdentifier)) {
                    const res = await api.get(`/public/tenant/${encodeURIComponent(portalIdentifier)}`);
                    if (isMounted && res.data) {
                        companyInfo = {
                            ...res.data,
                            tenantId: portalIdentifier,
                            code: res.data.code || companyInfo?.code || '',
                        };
                        setCandidateCompany(companyInfo);
                    }
                }

                if (isMounted && companyInfo) {
                    setLocalCompany(companyInfo);
                    setLogoUrl(resolveTenantLogoUrl(companyInfo));
                }
            } catch (err) {
                console.warn("Failed to fetch company info", err);
            } finally {
                if (isMounted) setPageLoading(false);
            }
        }
        fetchCompany();
        return () => { isMounted = false; };
    }, [portalIdentifier]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        const finalPortalIdentifier = portalIdentifier || getJobPortalIdentifier(searchParams);

        if (!finalPortalIdentifier) {
            setError('Invalid Access: Company ID missing. Please return to the careers page and click Login from there.');
            return;
        }

        setLoading(true);
        const res = await loginCandidate(finalPortalIdentifier, email, password);
        setLoading(false);

        if (res.success) {
            localStorage.setItem("candidate", JSON.stringify(res.candidate));
            if (redirectPath && redirectPath.startsWith('/')) {
                navigate(redirectPath, { replace: true });
            } else {
                navigate(`/candidate/dashboard`, { replace: true });
            }
        } else {
            const msg = res.message || 'Login failed';
            if (msg.toLowerCase().includes('invalid credentials') || msg.toLowerCase().includes('not found')) {
                setError('Email or password is incorrect. If you haven\'t registered yet, please create an account below.');
            } else if (msg.toLowerCase().includes('required fields') || msg.toLowerCase().includes('missing')) {
                setError('Company portal not found. Please access this page from the careers link.');
            } else {
                setError(msg);
            }
        }
    }

    const handleForgotSendOtp = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotSuccess('');
        setForgotDebugOtp('');
        
        const finalPortalIdentifier = portalIdentifier || getJobPortalIdentifier(searchParams);
        if (!finalPortalIdentifier) {
            setForgotError('Invalid Access: Company ID missing.');
            return;
        }

        setForgotLoading(true);
        try {
            const res = await api.post('/candidate/forgot-password/send-otp', {
                email: forgotEmail,
                tenantId: finalPortalIdentifier
            });
            if (res.data.success) {
                setForgotSuccess(res.data.message || 'Verification code sent to your email.');
                setForgotStep(2);
                if (res.data?.debugOtp) {
                    setForgotDebugOtp(res.data.debugOtp);
                }
            }
        } catch (err) {
            setForgotError(err.response?.data?.error || err.message || 'Failed to send verification code.');
        } finally {
            setForgotLoading(false);
        }
    };

    const handleForgotReset = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotSuccess('');
        
        const finalPortalIdentifier = portalIdentifier || getJobPortalIdentifier(searchParams);

        if (newPassword.length < 6) {
            setForgotError('Password must be at least 6 characters.');
            return;
        }

        setForgotLoading(true);
        try {
            const res = await api.post('/candidate/forgot-password/reset', {
                email: forgotEmail,
                tenantId: finalPortalIdentifier,
                otp: forgotOtp,
                newPassword: newPassword
            });
            if (res.data.success) {
                setForgotSuccess('Password reset successfully! Redirecting to login...');
                setTimeout(() => {
                    setIsForgotMode(false);
                    setForgotStep(1);
                    setForgotOtp('');
                    setNewPassword('');
                    setForgotEmail('');
                    setForgotSuccess('');
                    setForgotDebugOtp('');
                }, 3000);
            }
        } catch (err) {
            setForgotError(err.response?.data?.error || err.message || 'Failed to reset password.');
        } finally {
            setForgotLoading(false);
        }
    };

    if (pageLoading) {
        return <Loader fullPage={true} text="Loading Portal" />;
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col items-center justify-center py-4 px-4 relative overflow-hidden selection:bg-blue-100 selection:text-blue-600">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-slate-100/50 rounded-full blur-[60px] -z-10 translate-x-1/3 -translate-y-1/3"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-[60px] -z-10 -translate-x-1/3 translate-y-1/3"></div>

            <div className="w-full max-w-[420px] z-10 animate-in fade-in duration-300">
                <div className="text-center mb-6">
                    <div className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-blue-100/50 overflow-hidden ${
                        logoUrl ? 'bg-slate-50 border border-slate-100' : 'bg-blue-600'
                    }`}>
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
                        ) : (
                            <Briefcase className="text-white w-6 h-6" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
                        {isForgotMode ? 'Reset Password' : 'Welcome'}
                    </h1>
                    <p className="text-slate-500 font-medium text-xs">
                        {isForgotMode ? 'Recover your account access for ' : 'Continue your journey with '}
                        <span className="text-blue-600 font-bold">{company.name}</span>
                    </p>
                </div>

                <div className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-[0px_8px_16px_rgba(0,0,0,0.06)] border border-slate-50">
                    {isForgotMode ? (
                        forgotStep === 1 ? (
                            <form onSubmit={handleForgotSendOtp} className="space-y-5">
                                {forgotError && (
                                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2 text-rose-600 text-[11px] font-bold animate-in fade-in slide-in-from-top-2">
                                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                                        {forgotError}
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">Email Address</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                            <input
                                                type="email"
                                                placeholder="name@example.com"
                                                className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300 shadow-sm shadow-slate-100/50"
                                                required
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={forgotLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 text-[10px] uppercase tracking-widest"
                                >
                                    {forgotLoading ? 'Sending...' : 'Send Verification Code'}
                                </button>
                                <div className="text-center mt-4">
                                    <button
                                        type="button"
                                        onClick={() => { setIsForgotMode(false); setForgotError(''); setForgotSuccess(''); }}
                                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        Back to Login
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleForgotReset} className="space-y-5">
                                {forgotError && (
                                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2 text-rose-600 text-[11px] font-bold animate-in fade-in slide-in-from-top-2">
                                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                                        {forgotError}
                                    </div>
                                )}
                                {forgotDebugOtp && (
                                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl text-amber-700 text-xs font-bold text-center mb-4">
                                        [DEV ONLY] OTP Code: <span className="text-sm font-extrabold select-all tracking-wider ml-1">{forgotDebugOtp}</span>
                                    </div>
                                )}
                                {forgotSuccess && (
                                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2 text-emerald-600 text-[11px] font-bold animate-in fade-in slide-in-from-top-2">
                                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                        {forgotSuccess}
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">Verification Code (OTP)</label>
                                        <div className="relative group">
                                            <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Enter 6-digit OTP"
                                                className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300 shadow-sm shadow-slate-100/50"
                                                required
                                                value={forgotOtp}
                                                onChange={(e) => setForgotOtp(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">New Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                            <input
                                                type="password"
                                                placeholder="••••••••"
                                                className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300 shadow-sm shadow-slate-100/50"
                                                required
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={forgotLoading || (forgotSuccess && forgotSuccess.includes('successfully'))}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 text-[10px] uppercase tracking-widest"
                                >
                                    {forgotLoading ? 'Resetting...' : 'Reset Password'}
                                </button>
                                <div className="text-center mt-4">
                                    <button
                                        type="button"
                                        onClick={() => { setForgotStep(1); setForgotError(''); setForgotSuccess(''); }}
                                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        Back
                                    </button>
                                </div>
                            </form>
                        )
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2 text-rose-600 text-[11px] font-bold animate-in fade-in slide-in-from-top-2">
                                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                        <input
                                            type="email"
                                            placeholder="name@example.com"
                                            className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300 shadow-sm shadow-slate-100/50"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300 shadow-sm shadow-slate-100/50"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between px-1">
                                <label className="flex items-center gap-1.5 cursor-pointer group">
                                    <input type="checkbox" className="w-4 h-4 rounded border-slate-200 text-blue-600 focus:ring-blue-500/20" />
                                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Keep me signed in</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsForgotMode(true)}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    Forgot Password?
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 text-[10px] uppercase tracking-widest"
                            >
                                {loading ? 'Loading...' : (
                                    <>
                                        Sign In <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    <div className="mt-6 pt-6 border-t border-slate-50 text-center">
                        <p className="text-slate-500 text-xs font-medium">
                            Don't have an account?{' '}
                            <Link
                                to={portalIdentifier
                                    ? `/candidate/signup?tenantId=${encodeURIComponent(portalIdentifier)}${redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : ''}`
                                    : '/candidate/signup'}
                                className="text-blue-600 font-bold hover:text-blue-700 transition-colors ml-1 underline underline-offset-4 decoration-blue-200"
                            >
                                Start your application
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <Link to={company.code || portalIdentifier ? `/jobs/${company.code || portalIdentifier}` : '/'} className="text-slate-400 font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-2.5 hover:text-blue-500 transition-colors group">
                        <div className="bg-slate-100 p-1.5 rounded-lg group-hover:bg-blue-50 transition-colors">
                            <ArrowLeft size={14} />
                        </div>
                        Back to Career Page
                    </Link>
                </div>
            </div>
        </div>
    );
}
