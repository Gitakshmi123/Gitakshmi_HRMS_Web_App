import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import api, { resolveTenantLogoUrl } from '../../utils/api';
import { getCompany, setCompany } from '../../utils/auth';
import { companyMatchesPortalIdentifier, getJobPortalIdentifier } from '../../utils/jobPortalContext';
import { ArrowLeft, ArrowRight, Briefcase, Lock, Mail, User, Phone, ShieldCheck, Sparkles } from 'lucide-react';

export default function CandidateSignup() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { registerCandidate, loginCandidate } = useJobPortalAuth();

    const portalIdentifier = getJobPortalIdentifier(searchParams);
    const redirectPath = searchParams.get('redirect');
    const [company, setLocalCompany] = useState({ name: 'Careers', code: '' });
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [logoUrl, setLogoUrl] = useState(() => {
        const stored = getCompany();
        return stored ? resolveTenantLogoUrl(stored) : null;
    });
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    useEffect(() => {
        async function fetchCompany() {
            if (!portalIdentifier) {
                setPageLoading(false);
                return;
            }

            setPageLoading(true);
            try {
                let companyInfo = getCompany();

                if (!companyMatchesPortalIdentifier(companyInfo, portalIdentifier)) {
                    const res = await api.get(`/public/tenant/${encodeURIComponent(portalIdentifier)}`);
                    if (res.data) {
                        companyInfo = {
                            ...res.data,
                            tenantId: portalIdentifier,
                            code: res.data.code || companyInfo?.code || '',
                        };
                        setCompany(companyInfo);
                    }
                }

                if (companyInfo) {
                    setLocalCompany(companyInfo);
                    setLogoUrl(resolveTenantLogoUrl(companyInfo));
                }
            } catch (err) {
                console.warn("Failed to fetch company info", err);
            } finally {
                setPageLoading(false);
            }
        }
        fetchCompany();
    }, [portalIdentifier]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    async function handleRequestOtp(e) {
        if (e) e.preventDefault();
        setError('');

        const finalPortalIdentifier = portalIdentifier || getJobPortalIdentifier(searchParams);
        if (!finalPortalIdentifier) {
            setError('Portal Configuration Missing: Please access this registration page from your company\'s unique career link.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/candidate/send-otp', {
                email: formData.email,
                tenantId: finalPortalIdentifier
            });
            setLoading(false);
            if (res.data?.success) {
                setOtpSent(true);
                setResendTimer(60);
            } else {
                setError(res.data?.message || 'Failed to send verification code.');
            }
        } catch (err) {
            setLoading(false);
            const parsed = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to send verification code.';
            setError(parsed);
        }
    }

    async function handleVerifyAndRegister(e) {
        e.preventDefault();
        setError('');

        if (!otp) {
            setError('Please enter the 6-digit verification code.');
            return;
        }

        const finalPortalIdentifier = portalIdentifier || getJobPortalIdentifier(searchParams);
        if (!finalPortalIdentifier) {
            setError('Portal Configuration Missing: Please access this registration page from your company\'s unique career link.');
            return;
        }

        setLoading(true);
        const res = await registerCandidate({
            ...formData,
            mobile: formData.phone,
            tenantId: finalPortalIdentifier,
            companyCode: company?.code || undefined,
            otp: otp
        });

        if (res.success) {
            const loginRes = await loginCandidate(finalPortalIdentifier, formData.email, formData.password);
            setLoading(false);
            if (loginRes.success) {
                localStorage.setItem("candidate", JSON.stringify(loginRes.candidate));
                if (redirectPath && redirectPath.startsWith('/')) {
                    navigate(redirectPath, { replace: true });
                } else {
                    navigate(`/candidate/dashboard`, { replace: true });
                }
            } else {
                navigate(`/candidate/login?tenantId=${encodeURIComponent(finalPortalIdentifier)}${redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : ''}`);
            }
        } else {
            setLoading(false);
            setError(res.message);
        }
    }

    if (pageLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Initialising Portal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col items-center justify-center py-4 px-4 relative overflow-hidden selection:bg-blue-100 selection:text-blue-600">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-slate-100/50 rounded-full blur-[60px] -z-10 translate-x-1/3 -translate-y-1/3"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-[60px] -z-10 -translate-x-1/3 translate-y-1/3"></div>

            <div className="w-full max-w-[480px] z-10 animate-in fade-in duration-300">
                {/* Header Section */}
                <div className="text-center mb-4">
                    <div className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-2 shadow-lg shadow-blue-100/50 overflow-hidden ${
                        logoUrl ? 'bg-slate-50 border border-slate-100' : 'bg-blue-600'
                    }`}>
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
                        ) : (
                            <Briefcase className="text-white w-6 h-6" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-1">Create Account</h1>
                    <p className="text-slate-500 font-medium text-xs">Join <span className="text-blue-600 font-bold">{company.name}</span>'s talent network</p>
                </div>

                {/* Card */}
                <div className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-[0px_8px_16px_rgba(0,0,0,0.06)] border border-slate-50">
                    {error && (
                        <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2 text-rose-600 text-[11px] font-bold animate-in fade-in slide-in-from-top-2 mb-4">
                            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {!otpSent ? (
                        <form onSubmit={handleRequestOtp} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">Full Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                                        <input
                                            name="name"
                                            type="text"
                                            placeholder="John Doe"
                                            className="w-full pl-11 pr-5 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300 shadow-sm shadow-slate-100/50"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">Contact Phone</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                                        <input
                                            name="phone"
                                            type="tel"
                                            placeholder="+1 234 567"
                                            className="w-full pl-11 pr-5 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300 shadow-sm shadow-slate-100/50"
                                            required
                                            value={formData.phone}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                                        <input
                                            name="email"
                                            type="email"
                                            placeholder="name@example.com"
                                            className="w-full pl-11 pr-5 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300 shadow-sm shadow-slate-100/50"
                                            required
                                            value={formData.email}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">Account Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                                        <input
                                            name="password"
                                            type="password"
                                            placeholder="••••••••"
                                            className="w-full pl-11 pr-5 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-300 shadow-sm shadow-slate-100/50"
                                            required
                                            value={formData.password}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 rounded-xl">
                                <Sparkles className="text-blue-500 w-3.5 h-3.5" />
                                <p className="text-[9px] font-bold text-blue-600 leading-tight">By creating an account, you agree to our Terms of Service and Privacy Policy.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 text-[10px] uppercase tracking-widest"
                            >
                                {loading ? 'Sending Verification Code...' : (
                                    <>
                                        Complete Selection <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                            <div className="text-center py-2">
                                <p className="text-slate-500 text-xs font-medium">
                                    We've sent a 6-digit verification code to <span className="font-bold text-slate-800">{formData.email}</span>. Please enter it below:
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-3">Verification Code</label>
                                <div className="relative group">
                                    <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="123456"
                                        className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white text-center text-lg font-bold tracking-[0.4em] text-slate-700 placeholder:text-slate-300 placeholder:tracking-normal transition-all"
                                        required
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 text-[10px] uppercase tracking-widest"
                            >
                                {loading ? 'Verifying & Registering...' : (
                                    <>
                                        Verify & Create Account <ArrowRight size={16} />
                                    </>
                                )}
                            </button>

                            <div className="flex items-center justify-between pt-2 text-xs">
                                <button
                                    type="button"
                                    onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
                                    className="text-slate-400 hover:text-slate-600 font-bold transition-colors"
                                >
                                    Change Email
                                </button>
                                {resendTimer > 0 ? (
                                    <span className="text-slate-400 font-medium">
                                        Resend code in <span className="font-bold">{resendTimer}s</span>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleRequestOtp}
                                        className="text-blue-600 hover:text-blue-700 font-bold transition-colors"
                                    >
                                        Resend Code
                                    </button>
                                )}
                            </div>
                        </form>
                    )}

                    <div className="mt-4 pt-4 border-t border-slate-50 text-center">
                        <p className="text-slate-500 text-xs font-medium">
                            Already part of our network?{' '}
                            <Link
                                to={portalIdentifier
                                    ? `/candidate/login?tenantId=${encodeURIComponent(portalIdentifier)}${redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : ''}`
                                    : '/candidate/login'}
                                className="text-blue-600 font-bold hover:text-blue-700 transition-colors ml-1 underline underline-offset-4 decoration-blue-200"
                            >
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <Link to={company.code || portalIdentifier ? `/jobs/${company.code || portalIdentifier}` : '/'} className="text-slate-400 font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-2.5 hover:text-blue-50 transition-colors group">
                        <div className="bg-slate-100 p-1.5 rounded-lg group-hover:bg-blue-50 transition-colors">
                            <ArrowLeft size={14} />
                        </div>
                        Back to Portal
                    </Link>
                </div>
            </div>
        </div>
    );
}
