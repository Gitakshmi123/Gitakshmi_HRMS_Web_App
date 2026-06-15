import { createContext } from 'react';

/**
 * Shared Context instance for RBAC to avoid HMR reference issues.
 */
const PermissionContext = createContext(null);

export default PermissionContext;
