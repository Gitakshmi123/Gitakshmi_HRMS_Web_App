import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import api from '../../utils/api';
import { getCompany, getTenantId } from '../../utils/auth';
import {
    Briefcase, MapPin, Clock, ArrowRight, Layers,
    TrendingUp, CheckCircle2, XCircle, AlertCircle, Sparkles
} from 'lucide-react';

export default function CandidateDashboard() {
    const navigate = useNavigate();
    const { candidate } = useJobPortalAuth();
    const [stats, setStats] = useState({ total: 0, applied: 0, inProgress: 0, selected: 0, rejected: 0 });
    const [loading, setLoading] = useState(true);
    const [companyName, setCompanyName] = useState('Careers');
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const tid = candidate?.tenantId || getTenantId();

            if (!tid) {
                setError("Company identification lost. Please log in again.");
                setLoading(false);
                return;
            }

            let applications = [];
            try {
                const dashRes = await api.get(`/candidate/dashboard`);
                if (dashRes.data) {
                    applications = dashRes.data.applications || [];
                }
            } catch (dashErr) {
                console.warn("Could not fetch candidate stats:", dashErr.message);
            }

            const isArray = Array.isArray(applications);
            setStats({
                total: isArray ? applications.length : (applications.total || 0),
                applied: isArray
                    ? applications.filter(a => a?.status && a.status.toLowerCase() === 'applied').length
                    : (applications.applied || 0),
                inProgress: isArray
                    ? applications.filter(a => {
                        if (!a?.status) return false;
                        const status = a.status.toLowerCase();
                        return !['hired', 'rejected', 'selected', 'offered', 'joining letter issued'].includes(status);
                    }).length
                    : (applications.inProgress || 0),
                selected: isArray
                    ? applications.filter(a => {
                        if (!a?.status) return false;
                        const status = a.status.toLowerCase();
                        return ['hired', 'selected', 'offered', 'joining letter issued'].includes(status);
                    }).length
                    : (applications.selected || 0),
                rejected: isArray
                    ? applications.filter(a => a?.status && a.status.toLowerCase() === 'rejected').length
                    : (applications.rejected || 0),
                items: isArray ? applications : (applications.items || [])
            });

        } catch (err) {
            setError(err.response?.data?.error || "Failed to load dashboard data. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [candidate]);

    useEffect(() => {
        const company = getCompany();
        if (company?.name) {
            setCompanyName(company.name);
        }
        fetchData();
    }, [fetchData]);

    if (loading) return (
        <div className="h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Dashboard...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="h-[60vh] flex items-center justify-center">
            <div className="max-w-md bg-white p-10 rounded-[2rem] shadow-[0px_8px_16px_rgba(0,0,0,0.06)] border border-slate-100 text-center">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Oops! Something went wrong</h3>
                <p className="text-slate-500 font-medium mb-8 leading-relaxed">{error}</p>
                <button
                    onClick={fetchData}
                    className="bg-blue-600 text-white px-10 py-3.5 rounded-full font-bold hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto"
                >
                    Retry Now
                </button>
            </div>
        </div>
    );

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Luxury Header Section */}
            {/* Luxury Header Section */}
            {/* Luxury Header Section */}
            <div className="relative overflow-hidden bg-premium-gradient rounded-[1.5rem] p-6 lg:p-8 text-white shadow-xl shadow-blue-200/50">
                {/* Minimal Background Elements */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-blue-400/20 rounded-full blur-[60px] -ml-24 -mb-24"></div>

                <div className="relative z-10">
                    <div className="max-w-3xl">
                        <h1 className="leading-tight mb-2 text-white font-black" style={{ fontSize: '48px' }}>
                            {getGreeting()} <span className="text-mint-aqua" style={{ fontSize: 'inherit' }}>{candidate?.name?.split(' ')[0] || 'Candidate'}</span>.
                        </h1>
                    </div>

                    <div className="flex flex-wrap gap-4 mt-8">
                        <button
                            onClick={() => navigate('/candidate/open-positions')}
                            className="px-8 py-4 bg-white hover:bg-slate-100 text-blue-600 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-3 active:scale-95"
                        >
                            View Openings <ArrowRight size={16} />
                        </button>
                        <button
                            onClick={() => navigate('/candidate/profile')}
                            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all backdrop-blur-md active:scale-95"
                        >
                            Update Profile
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Grid - Luxury Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Applied', value: stats.total, icon: Layers },
                    { label: 'In Progress', value: stats.inProgress, icon: TrendingUp },
                    { label: 'Shortlisted', value: stats.selected, icon: CheckCircle2 },
                    { label: 'Not Proceeded', value: stats.rejected, icon: XCircle },
                ].map((stat, idx) => (
                    <div
                        key={idx}
                        className="group bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgba(74,143,231,0.1)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                    >
                        {/* Subtle Gradient Backlight on Hover */}
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-premium-blue/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                        <div className="flex items-start justify-between">
                            <div className="relative z-10">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">{stat.label}</p>
                                <h3 className="text-4xl font-extrabold text-slate-800 tracking-tight">{stat.value}</h3>
                            </div>

                            <div className="w-14 h-14 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-blue-600 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 ease-out">
                                <stat.icon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>


        </div>
    );
}
