import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import api from '../../utils/api';
import { getCompany, getTenantId } from '../../utils/auth';
import {
    Briefcase, MapPin, Clock, ArrowRight, Layers,
    TrendingUp, CheckCircle2, XCircle, AlertCircle, Sparkles,
    ChevronRight
} from 'lucide-react';

const TRACKING_STAGES = [
    { label: 'Applied', backendKeys: ['applied'] },
    { label: 'Screening', backendKeys: ['shortlisted', 'screening'] },
    { label: 'Interview', backendKeys: ['interview', 'technical'] },
    { label: 'HR Round', backendKeys: ['hr', 'hr round'] },
    { label: 'Offered', backendKeys: ['offered', 'selected', 'offer issued', 'offer accepted', 'fully signed', 'finalized', 'hired', 'joining letter issued'] }
];

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

            {/* Active Applications Tracking Section */}
            <div className="space-y-6 mt-10">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full animate-pulse" />
                    <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Active Applications Tracking</h3>
                </div>
                
                {stats.items && stats.items.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                        {stats.items.map((app) => {
                            // Determine current stage index
                            const currentStatus = String(app.status || 'Applied').toLowerCase();
                            const currentStageName = String(app.currentStage?.stageName || '').toLowerCase();
                            
                            let activeIndex = 0;
                            for (let i = 0; i < TRACKING_STAGES.length; i++) {
                                const keys = TRACKING_STAGES[i].backendKeys;
                                if (keys.some(k => currentStatus.includes(k) || currentStageName.includes(k))) {
                                    activeIndex = i;
                                }
                            }
                            
                            return (
                                <div 
                                    key={app._id}
                                    onClick={() => navigate(`/candidate/application/${app._id}`)}
                                    className="group bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-blue-200 shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-[0_12px_32px_rgba(74,143,231,0.08)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer relative overflow-hidden"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
                                                <Briefcase size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-850 text-md leading-tight group-hover:text-blue-600 transition-colors uppercase">
                                                    {app.requirementId?.jobTitle || 'Position'}
                                                </h4>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                    {app.requirementId?.department || 'General'} • Applied {app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 self-start md:self-auto">
                                            <span className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${
                                                ['hired', 'selected', 'offered', 'joining letter issued'].includes(currentStatus)
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    : currentStatus === 'rejected'
                                                        ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                        : 'bg-blue-50 text-blue-600 border-blue-100'
                                            }`}>
                                                {app.status || 'Applied'}
                                            </span>
                                            <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                    
                                    {/* Timeline Step Bar */}
                                    <div className="mt-8 pt-4 border-t border-slate-50">
                                        <div className="relative flex justify-between items-center w-full">
                                            {/* Connecting Line */}
                                            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] bg-slate-100 dark:bg-slate-800 -z-10" />
                                            <div 
                                                className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] bg-gradient-to-r from-blue-500 to-indigo-600 -z-10 transition-all duration-500" 
                                                style={{ width: `${(activeIndex / (TRACKING_STAGES.length - 1)) * 100}%` }}
                                            />
                                            
                                            {/* Steps */}
                                            {TRACKING_STAGES.map((stage, idx) => {
                                                const isCompleted = idx < activeIndex;
                                                const isActive = idx === activeIndex;
                                                const isRejected = currentStatus === 'rejected' && isActive;
                                                
                                                return (
                                                    <div key={idx} className="flex flex-col items-center relative">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
                                                            isCompleted 
                                                                ? 'bg-blue-600 border-white text-white shadow-md shadow-blue-500/20' 
                                                                : isActive 
                                                                    ? isRejected
                                                                        ? 'bg-rose-500 border-white text-white shadow-md shadow-rose-500/20 animate-pulse'
                                                                        : 'bg-indigo-600 border-white text-white shadow-md shadow-indigo-500/20 animate-pulse'
                                                                    : 'bg-white border-slate-200 text-slate-400'
                                                        }`}>
                                                            {isCompleted ? (
                                                                <CheckCircle2 size={12} strokeWidth={3} />
                                                            ) : (
                                                                <div className={`w-2 h-2 rounded-full ${
                                                                    isActive 
                                                                        ? 'bg-white' 
                                                                        : 'bg-slate-300'
                                                                }`} />
                                                            )}
                                                        </div>
                                                        <span className={`hidden sm:block text-[8px] font-black uppercase tracking-widest mt-2 whitespace-nowrap ${
                                                            isActive 
                                                                ? isRejected ? 'text-rose-600' : 'text-indigo-600' 
                                                                : 'text-slate-400'
                                                        }`}>
                                                            {stage.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-100 text-center">
                        <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">No Active Applications</h4>
                        <p className="text-xs text-slate-400 max-w-[280px] mx-auto mt-2 leading-relaxed">
                            You haven't submitted any job applications. View available openings to apply!
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
}
