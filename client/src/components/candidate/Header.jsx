import React from 'react';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import { getCompany } from '../../utils/auth';
import { ArrowLeft, LogOut, User as UserIcon, LayoutDashboard, Briefcase, FileText, User, UploadCloud } from 'lucide-react';
import CandidateNotificationDropdown from './CandidateNotificationDropdown';

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { candidate, logoutCandidate } = useJobPortalAuth();

    const isMainDashboard = location.pathname === '/candidate/dashboard';

    // Get company for back navigation
    const company = getCompany();

    const handleBack = () => {
        if (company && company.code) {
            navigate(`/jobs/${company.code}`);
        } else if (company && (company.tenantId || company._id)) {
            navigate(`/jobs/${company.tenantId || company._id}`);
        } else {
            navigate('/');
        }
    };

    const handleLogout = () => {
        const companyInfo = getCompany();
        logoutCandidate();
        if (companyInfo && (companyInfo.code || companyInfo.tenantId || companyInfo._id)) {
            navigate(`/jobs/${companyInfo.code || companyInfo.tenantId || companyInfo._id}`);
        } else {
            navigate('/');
        }
    };

    const menuItems = [
        { name: 'Dashboard', path: '/candidate/dashboard', icon: LayoutDashboard },
        { name: 'Open Positions', path: '/candidate/open-positions', icon: Briefcase },
        { name: 'My Applications', path: '/candidate/applications', icon: FileText },
        { name: 'My Profile', path: '/candidate/profile', icon: User },
        { name: 'Upload Documents', path: '/candidate/upload-documents', icon: UploadCloud },
    ];

    return (
        <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-10 supports-[backdrop-filter]:bg-white/60">
            <div className="flex items-center gap-8">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-xs uppercase tracking-widest transition-all group mr-6"
                >
                    <div className="bg-slate-50 p-2.5 rounded-xl group-hover:bg-blue-50 transition-colors border border-slate-100 group-hover:border-blue-100">
                        <ArrowLeft className="w-4 h-4" />
                    </div>
                    <span>Back to Portal</span>
                </button>

                <nav className="hidden xl:flex items-center gap-2">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/candidate/dashboard'}
                            className={({ isActive }) => `
                                px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2.5 border border-transparent
                                ${isActive
                                    ? 'bg-blue-50 text-blue-600 border-blue-100 shadow-sm'
                                    : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}
                            `}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.name}
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="flex items-center gap-6">
                <CandidateNotificationDropdown />

                <div className="h-8 w-px bg-slate-100"></div>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-[13px] font-black text-slate-800 leading-none mb-1">{candidate?.name || 'Candidate'}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Global Account</p>
                    </div>
                    <div
                        className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 border border-slate-100 p-1 shadow-sm group cursor-pointer hover:border-premium-blue transition-colors flex items-center justify-center overflow-hidden"
                        onClick={() => navigate('/candidate/profile')}
                    >
                        <span className="text-white font-black text-sm group-hover:scale-110 transition-transform">
                            {candidate?.name ? candidate.name.charAt(0).toUpperCase() : 'C'}
                        </span>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="bg-white text-slate-400 p-2.5 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95 border border-slate-100 hover:border-rose-100 shadow-sm"
                    title="Logout"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        </header>
    );
}
