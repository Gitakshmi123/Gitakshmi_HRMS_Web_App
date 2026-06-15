import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import {
    User, LogOut, ChevronDown,
    Settings, Shield, LayoutDashboard, Briefcase, FileText
} from 'lucide-react';

const CandidateProfileMenu = ({ isTransparent = false }) => {
    const { candidate, logoutCandidate } = useJobPortalAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    const handleLogout = () => {
        const tid = candidate?.tenantId || localStorage.getItem('tenantId');
        logoutCandidate();
        if (tid) {
            navigate(`/jobs/${tid}`);
        } else {
            navigate('/');
        }
    };

    const initial = candidate?.name ? candidate.name.charAt(0).toUpperCase() : 'C';

    const menuItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/candidate/dashboard' },
        { label: 'Open Positions', icon: Briefcase, path: '/candidate/open-positions' },
        { label: 'My Applications', icon: FileText, path: '/candidate/applications' },
        { label: 'Profile Settings', icon: User, path: '/candidate/profile' },
    ];

    return (
        <div className="relative">
            <button
                onClick={toggleMenu}
                className={`flex items-center gap-3 px-2 py-2 rounded-2xl transition-all active:scale-95
                    ${isTransparent
                        ? 'bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 shadow-none'
                        : 'bg-white shadow-sm border border-slate-100 hover:bg-slate-50 hover:shadow-md'}`}
            >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm
                    ${isTransparent ? 'bg-white text-blue-600' : 'bg-gradient-to-tr from-blue-600 to-blue-700 text-white'}`}>
                    {initial}
                </div>
                <div className="text-left hidden sm:block pr-2">
                    <p className={`text-xs font-bold truncate max-w-[100px] leading-tight
                        ${isTransparent ? 'text-white' : 'text-slate-700'}`}>
                        {candidate?.name?.split(' ')[0] || 'Candidate'}
                    </p>
                </div>
                <ChevronDown size={14} className={`mr-2 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}
                    ${isTransparent ? 'text-white/70' : 'text-slate-400'}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-60 bg-white rounded-3xl shadow-[0px_8px_16px_rgba(0,0,0,0.06)] border border-slate-100 py-3 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                        {/* Header in Dropdown */}
                        <div className="px-5 py-4 border-b border-slate-50 mb-2">
                            <p className="text-sm font-bold text-slate-800 truncate">{candidate?.name || 'Candidate'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate mt-0.5">{candidate?.email}</p>
                        </div>

                        {/* Items */}
                        <div className="px-2 space-y-1">
                            {menuItems.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        navigate(item.path);
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-blue-50/50 hover:text-blue-600 transition-all text-sm font-bold"
                                >
                                    <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-blue-600">
                                        <item.icon size={16} />
                                    </div>
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* Divider */}
                        <div className="my-2 border-t border-slate-50 mx-2"></div>

                        {/* Logout */}
                        <div className="px-2">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all text-sm font-bold"
                            >
                                <div className="p-1.5 rounded-lg bg-rose-50/50 text-rose-400">
                                    <LogOut size={16} />
                                </div>
                                Logout
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CandidateProfileMenu;
