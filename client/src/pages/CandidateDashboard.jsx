import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCandidate } from '../utils/auth';
import api from '../utils/api';
import {
    User, Mail, Phone, Calendar, Briefcase, ChevronRight,
    FileText, Edit2, LogOut, CheckCircle2, Clock, XCircle,
    AlertCircle, MapPin, TrendingUp, Award, Layers
} from 'lucide-react';

export default function CandidateDashboard() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const candidate = getCandidate();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        if (!candidate) return;

        async function fetchDashboard() {
            try {
                const res = await api.get(`/candidate/dashboard?_t=${Date.now()}`);
                setApplications(res.data.applications || []);
            } catch (err) {
                console.error("Failed to load dashboard", err);
            } finally {
                setLoading(false);
            }
        }
        fetchDashboard();

        // Update greeting time
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    };

    const handleLogout = () => {
        logout();
        localStorage.removeItem('candidate');
        navigate('/jobs');
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Hired': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'Rejected': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'Offered': return 'bg-violet-50 text-violet-600 border-violet-100';
            case 'Interview': return 'bg-orange-50 text-orange-600 border-orange-100';
            default: return 'bg-blue-50 text-blue-600 border-blue-100';
        }
    };

    const stats = [
        { label: 'Total Applications', value: applications.length, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'In Progress', value: applications.filter(a => !['Hired', 'Rejected'].includes(a.status)).length, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Offers Received', value: applications.filter(a => a.status === 'Offered' || a.status === 'Hired').length, icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="relative">
                    <div className="h-16 w-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">

            {/* Navigation */}
            <nav className="bg-white/70 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/jobs')}>
                            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                                <Briefcase className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-5xl font-black tracking-tight text-gray-900">GITAKSHMI<span className="text-blue-600">.</span></span>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleLogout}
                                className="text-sm font-bold text-gray-500 hover:text-red-600 transition-colors px-4 py-2"
                            >
                                Sign Out
                            </button>
                            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white font-bold">
                                {candidate?.name?.charAt(0) || 'C'}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">

                {/* Header Section */}
                <div className="mb-10">
                    <h1 className="text-gray-900 tracking-tight font-semibold" style={{ fontSize: '22px', lineHeight: '1.4' }}>
                        {getGreeting()} {candidate?.name.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-gray-500 mt-1 font-medium italic">Here's what's happening with your job search today.</p>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Left Panel: Profile & Stats */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Profile Card */}
                        <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden relative group">
                            <div className="h-32 bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 animate-gradient-x"></div>
                            <div className="px-8 pb-8 relative">
                                <div className="absolute -top-12 left-8 p-1 bg-white rounded-3xl shadow-2xl">
                                    <div className="h-24 w-24 bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center border border-gray-50 text-white font-bold text-4xl">
                                        {candidate?.name?.charAt(0)?.toUpperCase() || 'C'}
                                    </div>
                                </div>

                                <div className="mt-16">
                                    <h2 className="text-2xl font-black text-gray-900">{candidate?.name}</h2>
                                    <div className="flex items-center gap-2 mt-2 text-blue-600 bg-blue-50 w-fit px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                        <Award className="w-3 h-3" /> Professional Candidate
                                    </div>
                                </div>

                                <div className="mt-8 space-y-4">
                                    {[
                                        { icon: Mail, label: 'Email', value: candidate?.email },
                                        { icon: Phone, label: 'Phone', value: candidate?.mobile || 'Not set' },
                                        { icon: MapPin, label: 'Location', value: 'Remote / India' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-4 py-1">
                                            <div className="bg-gray-50 p-2.5 rounded-xl text-gray-400">
                                                <item.icon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.label}</p>
                                                <p className="text-sm font-bold text-gray-700 truncate max-w-[200px]">{item.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button className="w-full mt-8 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl shadow-gray-200 hover:bg-black hover:-translate-y-1 transition-all active:scale-95">
                                    Manage Profile
                                </button>
                            </div>
                        </div>

                        {/* Resume Status Card */}
                        <div className="bg-gradient-to-br from-blue-600 to-violet-700 rounded-[2rem] p-8 text-white relative overflow-hidden group shadow-xl shadow-blue-500/20">
                            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                            <div className="relative z-10">
                                <FileText className="w-8 h-8 text-blue-100 mb-4" />
                                <h3 className="text-xl font-bold">Resume Boost</h3>
                                <p className="text-blue-100 text-sm mt-2 leading-relaxed opacity-80">Your resume is up to date and correctly formatted for ATS scanner.</p>
                                <div className="mt-6 flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
                                    <div className="bg-emerald-400 p-1 rounded-full"><CheckCircle2 className="w-3 h-3 text-white" /></div>
                                    <span className="text-xs font-bold tracking-tight">resume_candidate_2024.pdf</span>
                                </div>
                            </div>
                        </div>

                        {/* Pending HR Documents Widget */}
                        {applications.some(a => ['Document Requested', 'Reupload Required', 'Resubmitted', 'Document Verification Pending'].includes(a.status)) && (
                            <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-orange-500/20">
                                <AlertCircle className="w-8 h-8 text-white/80 mb-4" />
                                <h3 className="text-xl font-bold mb-2">Pending HR Documents</h3>
                                <p className="text-white/80 text-sm leading-relaxed mb-6">
                                    HR has requested your profile details and documents to proceed with your application.
                                </p>
                                <button 
                                    onClick={() => {
                                        const targetApp = applications.find(a => ['Document Requested', 'Reupload Required', 'Resubmitted', 'Document Verification Pending'].includes(a.status));
                                        if (targetApp) navigate(`/candidate/application/${String(targetApp._id || targetApp.id || targetApp.applicationId)}`);
                                    }}
                                    className="w-full py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition"
                                >
                                    Complete Profile
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Stats & Applications */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {stats.map((stat, idx) => (
                                <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ring-4 ring-transparent hover:ring-white transition-all`}>
                                        <stat.icon className="w-6 h-6" />
                                    </div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                                    <h4 className="text-3xl font-black text-gray-900 mt-1">{stat.value}</h4>
                                </div>
                            ))}
                        </div>

                        {/* Applications Section */}
                        <div>
                            <div className="flex items-center justify-between mb-6 px-2">
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Active Applications</h3>
                                <button onClick={() => navigate('/jobs')} className="text-blue-600 font-bold text-sm bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors">
                                    Find Jobs
                                </button>
                            </div>

                            {applications.length > 0 ? (
                                <div className="space-y-4">
                                    {applications.map((app) => (
                                        <div
                                            key={app._id}
                                            onClick={() => navigate(`/candidate/application/${String(app._id || app.id || app.applicationId)}`)}
                                            className="group bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-blue-900/10 hover:-translate-y-1 transition-all cursor-pointer relative"
                                        >
                                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                                                <div className="flex items-center gap-5">
                                                    <div className="h-16 w-16 rounded-[1.25rem] bg-gray-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-500">
                                                        <Briefcase className="w-8 h-8 text-gray-400 group-hover:text-white transition-colors" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                                                            {app.requirementId?.jobTitle}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-1.5">
                                                            <span className="text-sm text-gray-400 font-bold">{app.requirementId?.companyName || 'Global IT'}</span>
                                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                                                            <span className="text-sm text-gray-400 font-bold">{app.requirementId?.department}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Status</p>
                                                        <div className="mt-2">
                                                            <span className={`px-4 py-1.5 rounded-full text-xs font-black border flex items-center gap-2 shadow-sm ${getStatusStyle(app.status)}`}>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                                {app.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-50 p-3 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                                                        <ChevronRight className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white rounded-[2.5rem] p-16 text-center border-2 border-dashed border-gray-100">
                                    <div className="h-24 w-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                                        <Briefcase className="w-12 h-12 text-gray-300" />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900">Your future starts here.</h3>
                                    <p className="text-gray-400 mt-2 font-medium max-w-sm mx-auto leading-relaxed">You haven't applied to any roles yet. Let's find your dream job together.</p>
                                    <button
                                        onClick={() => navigate('/jobs')}
                                        className="mt-10 bg-blue-600 text-white px-10 py-4 rounded-[1.5rem] font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-1 transition-all"
                                    >
                                        Explore Opportunities
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
