import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, FileText, User, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
    const { user } = useAuth();
    const [companyName, setCompanyName] = useState('Gitakshmi');

    useEffect(() => {
        if (user?.companyName) {
            setCompanyName(user.companyName);
        } else {
            const comp = localStorage.getItem('companyName');
            if (comp) setCompanyName(comp);
        }
    }, [user]);

    const menuItems = [
        { name: 'Dashboard Home', path: '/candidate/dashboard', icon: LayoutDashboard },
        { name: 'Open Positions', path: '/candidate/open-positions', icon: Briefcase },
        { name: 'My Applications', path: '/candidate/applications', icon: FileText },
        { name: 'My Profile', path: '/candidate/profile', icon: User },
    ];

    return (
        <aside className="w-72 bg-white flex flex-col border-r border-gray-100 hidden lg:flex h-screen sticky top-0 overflow-y-auto z-40">
            <div className="h-20 flex items-center px-8 border-b border-gray-50">
                <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-xl">
                    <Briefcase className="w-6 h-6 text-white" />
                </div>
                <span className="ml-3 text-xl font-black tracking-tight text-gray-900 uppercase">
                    {companyName}<span className="text-blue-600">.</span>
                </span>
            </div>

            <nav className="flex-1 px-4 py-8 space-y-2">
                <p className="px-4 text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Main Menu</p>
                {menuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/candidate/dashboard'}
                        className={({ isActive }) => `
                            flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-300 group
                            ${isActive
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30'
                                : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'}
                        `}
                    >
                        {({ isActive }) => (
                            <>
                                <div className="flex items-center gap-3">
                                    <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'}`} />
                                    <span className="font-bold text-sm tracking-tight">{item.name}</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 opacity-0 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'group-hover:opacity-100'}`} />
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

        </aside>
    );
}
