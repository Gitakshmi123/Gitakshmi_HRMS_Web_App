import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRBAC } from '../../context/RBACContext';

/**
 * ProtectedRoute
 * Wrap route components to check for module-level permissions.
 *
 * @param {string} module - The name of the module.
 * @param {string} action - Action ('view', 'create', 'edit', 'delete').
 */
const ProtectedRoute = ({ module, action = 'view', children }) => {
    const { hasPermission, loading } = useRBAC();
    const location = useLocation();

    if (loading) return <div>Loading permissions...</div>;

    const hasAccess = hasPermission(module, action);

    if (!hasAccess) {
        // Redirect to unauthorized page (or home)
        return <Navigate to="/unauthorized" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;
