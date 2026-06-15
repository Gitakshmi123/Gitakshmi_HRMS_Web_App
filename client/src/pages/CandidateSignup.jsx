import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useJobPortalAuth } from '../context/JobPortalAuthContext'; // Using core context
import api from '../utils/api';
import { ArrowLeft, ArrowRight, Briefcase, Lock, Mail, User, Phone, ShieldCheck, Sparkles } from 'lucide-react';

export default function CandidateSignup() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { registerCandidate, loginCandidate } = useJobPortalAuth();

    // Get tenantId from URL query param
    const rawTenantId = searchParams.get('tenantId');
    const tenantId = (rawTenantId && rawTenantId !== 'null' && rawTenantId !== 'undefined' && rawTenantId !== '[object Object]') ? rawTenantId : null;
    const redirect = searchParams.get('redirect') || '/jobs?tenantId=' + (tenantId || '');

    const [company, setCompany] = useState({ name: 'Company', code: '' });
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    // Fetch Company details on mount
    useEffect(() => {
        async function fetchCompany() {
            setPageLoading(true);
            try {
                if (tenantId) {
                    const res = await api.get(`/public/tenant/${tenantId}`);
                    setCompany(res.data);
                } else {
                    setError('Invalid Access: No Company Link detected. Please use a valid job link.');
                }
            } catch (err) {
                console.warn("Failed to fetch company info", err);
            } finally {
                setPageLoading(false);
            }
        }
        fetchCompany();
    }, [tenantId]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (!tenantId) {
            setError('Invalid Access: Company ID missing. Please return to the careers page.');
            return;
        }

        setLoading(true);
        // Register API call
        const res = await registerCandidate({ ...formData, tenantId });

        if (res.success) {
            // Auto Login after signup
            const loginRes = await loginCandidate(tenantId, formData.email, formData.password);
            setLoading(false);

            if (loginRes.success) {
                const navTo = redirect.startsWith('/') ? redirect : '/jobs/' + redirect;
                navigate(navTo);
            } else {
                // Fallback to login page if auto-login fails
                navigate(`/candidate/login?tenantId=${tenantId}&redirect=${encodeURIComponent(redirect)}`);
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
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col items-center justify-center py-12 px-6 relative overflow-hidden selection:bg-blue-100 selection:text-blue-600">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-50 rounded-full blur-[100px] -z-10 translate-x-1/3 -translate-y-1/3"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-50 rounded-full blur-[100px] -z-10 -translate-x-1/3 translate-y-1/3"></div>

            <div className="w-full max-w-[540px] z-10 animate-in fade-in duration-300">
                {/* Header Section */}
                <div className="text-center mb-12">
                    {/* Back Button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="absolute top-0 left-0 p-3 bg-white hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl shadow-sm border border-slate-100 transition-all group active:scale-95"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    </button>

                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-200 mb-8 transform hover:-rotate-6 transition-transform">
                        <Briefcase className="text-white w-8 h-8" />
                    </div>

                    <h1 className="text-4xl font-bold tracking-tight text-slate-800 mb-2">
                        {company.name}
                    </h1>
                    <p className="text-slate-500 font-medium tracking-tight">Create Candidate Account</p>
                </div>

                {/* Signup Card */}
                <div className="bg-white p-10 lg:p-14 rounded-[3rem] shadow-[0px_8px_16px_rgba(0,0,0,0.06)] border border-slate-50 overflow-hidden">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold animate-in fade-in slide-in-from-top-2">
                                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Full Name</label>
                                <div className="relative group">
                                    <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                    <input
                                        name="name"
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full pl-14 pr-8 py-5 bg-slate-50 border-none rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-medium text-slate-700 placeholder:text-slate-300"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Phone Number</label>
                                <div className="relative group">
                                    <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                    <input
                                        name="phone"
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full pl-14 pr-8 py-5 bg-slate-50 border-none rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-medium text-slate-700 placeholder:text-slate-300"
                                        placeholder="+1 234 567"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full pl-14 pr-8 py-5 bg-slate-50 border-none rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-medium text-slate-700 placeholder:text-slate-300"
                                        placeholder="name@example.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full pl-14 pr-8 py-5 bg-slate-50 border-none rounded-3xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-medium text-slate-700 placeholder:text-slate-300"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50/50 rounded-2xl">
                            <Sparkles className="text-blue-500 w-4 h-4" />
                            <p className="text-[10px] font-bold text-blue-600 leading-tight">By creating an account, you agree to our Terms of Service and Privacy Policy.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !tenantId}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 rounded-full font-bold shadow-xl shadow-blue-100 hover:shadow-2xl hover:translate-y-[-2px] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 text-[11px] uppercase tracking-[0.2em] mt-4"
                        >
                            {loading ? 'Creating Account...' : (
                                <>
                                    Complete Selection <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-12 pt-10 border-t border-slate-50 text-center">
                        <p className="text-slate-500 text-sm font-medium">
                            Already have an account?{' '}
                            <Link
                                to={`/candidate/login?tenantId=${tenantId}&redirect=${encodeURIComponent(redirect)}`}
                                className="text-blue-600 font-bold hover:text-blue-700 transition-colors ml-1 underline underline-offset-4 decoration-blue-200"
                            >
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
                        &copy; {new Date().getFullYear()} {company.name} <span className="mx-2">/</span> Powered by Gitakshmi HRMS
                    </p>
                </div>
            </div>
        </div>
    );
}
