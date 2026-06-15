import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobPortalAuth } from '../context/JobPortalAuthContext';
import { useAuth } from '../context/AuthContext';

const CandidateProtectedRoute = ({ children }) => {
    const navigate = useNavigate();
    const { isInitialized, candidate } = useJobPortalAuth();
    const { user, isInitialized: authInitialized } = useAuth(); // Check for HR/Admin session

    useEffect(() => {
        if (isInitialized && !candidate) {
            // If they are not a candidate, check if they are an HR/Admin
            const role = (user?.roleName || (typeof user?.role === 'object' ? user?.role?.name : user?.role) || '').toLowerCase();
            const isAdmin = ['hr', 'admin', 'company_super_admin', 'company_admin', 'manager'].includes(role);
            
            if (!isAdmin) {
                const currentPath = window.location.pathname + window.location.search;
                navigate(`/candidate/login?redirect=${encodeURIComponent(currentPath)}`, { replace: true });
            }
        }
    }, [isInitialized, candidate, navigate, user]);

    if (!isInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!candidate) {
        // Double check if admin allowed to pass through
        const role = (user?.roleName || (typeof user?.role === 'object' ? user?.role?.name : user?.role) || '').toLowerCase();
        const isAdmin = ['hr', 'admin', 'company_super_admin', 'company_admin', 'manager'].includes(role);
        
        if (!isAdmin) return null;
    }

    return children;
};

export default CandidateProtectedRoute;
