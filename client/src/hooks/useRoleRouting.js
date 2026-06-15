
import { useAuth } from '../context/AuthContext';
import { getBasePath, getRoleRoute } from '../utils/navigation';
import { useNavigate } from 'react-router-dom';

/**
 * A custom hook that provides role-aware navigation functions and prefixes.
 */
export function useRoleRouting() {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const role = user?.role;
    const prefix = getBasePath(role);
    
    /**
     * Navigates to a route with the correct role-based prefix.
     * @param {string} route - The target route (e.g., 'dashboard')
     * @param {Object} options - Standard react-router-dom navigate options
     */
    const navigateRole = (route, options) => {
        navigate(getRoleRoute(route, role), options);
    };
    
    return {
        prefix,
        getBasePath: () => getBasePath(role),
        getRoleRoute: (route) => getRoleRoute(route, role),
        navigateRole,
        role
    };
}
