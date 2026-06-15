import { createContext } from 'react';

/**
 * Shared Context instance for Auth to avoid HMR reference issues.
 */
export const AuthContext = createContext(null);

export default AuthContext;
