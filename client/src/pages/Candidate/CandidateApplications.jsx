import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import {
    Briefcase, Calendar, CheckCircle2, Clock,
    XCircle, ChevronRight, AlertCircle, Search, ArrowLeft, Building2, User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getHiringRoute } from '../../utils/navigation';

export default function CandidateApplications() {
    const navigate = useNavigate();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchApplications = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/candidate/dashboard?_t=${Date.now()}`);
            if (res.data && res.data.applications) {
                setApplications(res.data.applications);
            }
        } catch (err) {
            console.error("Failed to load applications:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    const getStatusStyle = (status) => {
        const s = status?.toLowerCase();
        if (['hired', 'selected', 'offered', 'joining letter issued'].includes(s)) return 'bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500/10';
        if (['interview', 'shortlisted'].includes(s)) return 'bg-soft-yellow/10 text-amber-600 border-amber-100 ring-amber-500/10';
        if (s === 'rejected') return 'bg-rose-50 text-rose-600 border-rose-100 ring-rose-500/10';
        return 'bg-slate-50 text-blue-600 border-blue-100 ring-blue-500/10';
    };

    const filteredApps = applications.filter(app => {
        if (!searchTerm || !searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
            app?.requirementId?.jobTitle?.toLowerCase()?.includes(term) ||
            app?.requirementId?.department?.toLowerCase()?.includes(term) ||
            app?.status?.toLowerCase()?.includes(term) ||
            app?.applicationId?.toLowerCase()?.includes(term)
        );
    });

    if (loading) return (
        <div className="h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Retrieving Submissions...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Search - Luxury Style */}
            {/* Header & Search - Corporate Style */}
            <div className="relative overflow-hidden py-4">
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="max-w-xl">
                        <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg mb-4">
                            <Clock size={12} className="text-blue-600" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Application History</span>
                        </div>
                    </div>
                    <div className="relative w-full lg:w-[400px]">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Filter by role or status..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:bg-white px-14 py-4 rounded-[1.5rem] text-sm font-bold text-slate-800 outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>


            {/* Application Cards */}
            {filteredApps.length === 0 ? (
                <div className="bg-white p-20 rounded-[2.5rem] border border-gray-100 text-center">
                    <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Briefcase size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">No applications found</h3>
                    <p className="text-slate-400 font-medium max-w-xs mx-auto mb-8">You haven't applied to any roles yet or your search didn't match any applications.</p>
                    <button
                        onClick={() => navigate('/candidate/open-positions')}
                        className="bg-blue-600 text-white px-10 py-3.5 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg"
                    >
                        Explore Jobs
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {filteredApps.map((app) => {
                        return (
                            <ApplicationCard 
                                key={app._id} 
                                app={app} 
                                navigate={navigate} 
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ApplicationCard({ app, navigate }) {
    const { user } = useAuth();
    const role = (user?.roleName || (typeof user?.role === 'object' ? user?.role?.name : user?.role) || '').toLowerCase();
    const isAdmin = ['hr', 'admin', 'company_super_admin', 'company_admin', 'manager'].includes(role);
    
    const handleNavigate = () => {
        // Force conversion to string to prevent [object Object] in URL
        const rawId = app._id || app.id || app.applicationId;
        const appId = typeof rawId === 'object' ? String(rawId?._id || rawId) : String(rawId);

        if (!appId || appId === 'undefined' || appId === '[object Object]') {
            console.error("[CandidateApplications] Invalid identifier detected:", { rawId, appId, app });
            return;
        }
        navigate(`/candidate/application/${appId}`);
    };

    const getStatusStyle = (status) => {
        const s = status?.toLowerCase();
        if (['hired', 'selected', 'offered', 'joining letter issued'].includes(s)) return 'bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-500/10';
        if (['interview', 'shortlisted'].includes(s)) return 'bg-soft-yellow/10 text-amber-600 border-amber-100 ring-amber-500/10';
        if (s === 'rejected') return 'bg-rose-50 text-rose-600 border-rose-100 ring-rose-500/10';
        return 'bg-slate-50 text-blue-600 border-blue-100 ring-blue-500/10';
    };

    return (
        <div
            onClick={handleNavigate}
            className="group bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden"
        >
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="flex items-center gap-6">
                <div className="h-14 w-14 rounded-[1.2rem] bg-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                    <Briefcase size={22} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2 group-hover:text-blue-600 transition-colors truncate">
                        {app?.requirementId?.jobTitle || 'Position Details'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg text-slate-500 font-bold text-[10px] uppercase tracking-wide">
                            <User size={12} className="text-slate-400" />
                            {app?.name || 'Applicant'}
                        </div>
                        <div className="flex items-center gap-1.5 bg-white border border-gray-100 px-3 py-1.5 rounded-lg text-slate-400 font-bold text-[10px] uppercase tracking-wide">
                            <Building2 size={12} className="text-slate-300" />
                            {app?.requirementId?.department || 'General'}
                        </div>
                        <div className="flex items-center gap-1.5 bg-white border border-gray-100 px-3 py-1.5 rounded-lg text-slate-400 font-bold text-[10px] uppercase tracking-wide">
                            <Calendar size={12} className="text-slate-300" />
                            {app.appliedDate ? new Date(app.appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                        </div>
                        {app?.requirementId?.location && (
                            <div className="flex items-center gap-1.5 bg-white border border-gray-100 px-3 py-1.5 rounded-lg text-slate-400 font-bold text-[10px] uppercase tracking-wide">
                                <span className="text-[12px]">📍</span>
                                {app.requirementId.location}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between lg:justify-end gap-12">
                <div className={`px-8 py-3 rounded-2xl border-2 text-[11px] font-black uppercase tracking-[0.2em] shadow-sm ${getStatusStyle(app.status)}`}>
                    {app.status || 'Applied'}
                </div>
                <div className="h-14 w-14 rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-blue-600 group-hover:text-white group-hover:rotate-90 transition-all duration-500">
                    <ChevronRight size={28} />
                </div>
            </div>
        </div>
    );
}
