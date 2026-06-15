import React from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, ConfigProvider } from 'antd';
import { LayoutDashboard, Users, Share2, History } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import CreatePost from './pages/CreatePost';
import PostHistory from './pages/PostHistory';
import usePagePermissions from '../../hooks/usePagePermissions';

const EnterpriseSocialDashboard = () => {
    const location = useLocation();
    const dashboardPerms = usePagePermissions('socialMedia.dashboard');
    const accountsPerms = usePagePermissions('socialMedia.accounts');
    const createPerms = usePagePermissions('socialMedia.create');
    const historyPerms = usePagePermissions('socialMedia.history');
    
    // Check if we have standard dashboard route
    const isDashboard = location.pathname.endsWith('/social-media') || location.pathname.endsWith('/social-media/');
    const isAccounts = location.pathname.includes('/accounts');
    const isCreate = location.pathname.includes('/create');
    const isHistory = location.pathname.includes('/history');

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#4F46E5', // indigo consistent with HRMS
                    borderRadius: 12,
                },
            }}
        >
            <div className="bg-white p-0">
                <div className="w-full">
                    <div className="px-6 py-4">
                        {isDashboard && dashboardPerms.canView && <Dashboard permissions={dashboardPerms} />}
                        {isAccounts && (accountsPerms.canView || accountsPerms.canCreate || accountsPerms.canDelete) && <Accounts permissions={accountsPerms} />}
                        {isCreate && createPerms.canView && <CreatePost permissions={createPerms} />}
                        {isHistory && historyPerms.canView && <PostHistory permissions={historyPerms} />}

                        {/* Standard Access Restricted feedback */}
                        {isDashboard && !dashboardPerms.canView && (
                            <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                                    <LayoutDashboard size={40} className="text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700">Access Restricted</h3>
                                <p className="max-w-xs text-center mt-2 leading-relaxed">
                                    You don't have permission to view Social Media Dashboard. Please contact your administrator.
                                </p>
                            </div>
                        )}
                        {/* Repeat for others if necessary, although AppRoutes usually handles them */}
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
};

export default EnterpriseSocialDashboard;
